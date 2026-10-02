import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from './generated/prisma/client';
import { MediaStatus } from './generated/prisma/enums';
import {
  ListMediaDto,
  MediaAssetDto,
  RequestUploadDto,
  RequestUploadResponseDto,
} from './media.dto';
import {
  DOWNLOAD_URL_EXPIRY_SECONDS,
  MAX_UPLOAD_SIZE_BYTES,
  PENDING_CLEANUP_INTERVAL_MS,
  UPLOAD_URL_EXPIRY_SECONDS,
  resolveMediaKind,
} from './media.constants';

// Les octets ne transitent jamais par la base : Prisma ne stocke que la clé de
// l'objet (MinIO en local, S3 en prod) et les clients passent par des URLs pré-signées.
@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly bucket = process.env.MEDIA_S3_BUCKET ?? 'lagonadeck-media';
  private readonly s3 = new S3Client({
    endpoint: process.env.MEDIA_S3_ENDPOINT,
    region: process.env.MEDIA_S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.MEDIA_S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY ?? '',
    },
  });

  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  onModuleInit() {
    setInterval(
      () =>
        this.purgeStalePendingAssets().catch((error) =>
          this.logger.error(`Échec de la purge des médias PENDING : ${error}`),
        ),
      PENDING_CLEANUP_INTERVAL_MS,
    ).unref();
  }

  async requestUpload(
    dto: RequestUploadDto,
  ): Promise<RequestUploadResponseDto> {
    const kind = resolveMediaKind(dto.contentType);
    if (!kind) {
      throw new BadRequestException(
        `Type de contenu non autorisé : ${dto.contentType}`,
      );
    }
    if (dto.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException(
        `Le fichier dépasse la taille maximale autorisée (${MAX_UPLOAD_SIZE_BYTES} octets).`,
      );
    }

    const id = randomUUID();
    const storageKey = `${kind.toLowerCase()}/${dto.ownerId}/${id}`;

    await this.prisma.mediaAsset.create({
      data: {
        id,
        ownerId: dto.ownerId,
        fileName: dto.fileName,
        storageKey,
        kind,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        status: MediaStatus.PENDING,
      },
    });

    // Un POST signé par policy fige le Content-Type et la taille exacte dans la
    // signature ; un PUT pré-signé ne signe pas le Content-Type.
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: storageKey,
      Expires: UPLOAD_URL_EXPIRY_SECONDS,
      Conditions: [
        ['content-length-range', dto.sizeBytes, dto.sizeBytes],
        ['eq', '$Content-Type', dto.contentType],
      ],
      Fields: { 'Content-Type': dto.contentType },
    });

    return {
      id,
      uploadUrl: url,
      uploadFields: fields,
      expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
    };
  }

  async confirmUpload(id: string): Promise<MediaAssetDto> {
    const asset = await this.getAssetOrThrow(id);

    const object = await this.headObject(asset.storageKey);
    if (!object) {
      await this.prisma.mediaAsset.update({
        where: { id },
        data: { status: MediaStatus.FAILED },
      });
      throw new UnprocessableEntityException(
        "Aucun binaire trouvé sur l'object storage pour ce média : l'upload n'a pas abouti.",
      );
    }

    const sizeMismatch = object.ContentLength !== asset.sizeBytes;
    const contentTypeMismatch = object.ContentType !== asset.contentType;

    if (sizeMismatch || contentTypeMismatch) {
      // On fige d'abord l'état métier (FAILED) : le nettoyage du binaire est
      // de l'hygiène de stockage et ne doit pas empêcher l'appelant d'obtenir
      // une réponse cohérente si la suppression échoue (droits, storage
      // indisponible...). Un binaire orphelin résiduel sera repris par
      // purgeStalePendingAssets, ou peut être nettoyé manuellement.
      await this.prisma.mediaAsset.update({
        where: { id },
        data: { status: MediaStatus.FAILED },
      });
      try {
        await this.deleteObject(asset.storageKey);
      } catch (error) {
        this.logger.warn(
          `Échec de la suppression du binaire incohérent ${asset.storageKey} : ${error}`,
        );
      }
      throw new UnprocessableEntityException(
        sizeMismatch
          ? 'La taille du binaire uploadé ne correspond pas à la taille annoncée.'
          : 'Le type de contenu du binaire uploadé ne correspond pas au type annoncé.',
      );
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: { status: MediaStatus.READY },
    });

    return this.toDto(updated);
  }

  /**
   * Purge les médias restés PENDING après l'expiration de leur URL d'upload :
   * soit le client n'a jamais uploadé, soit il a été interrompu avant de
   * confirmer. Sans cette purge, ces enregistrements (et un éventuel binaire
   * partiel) restent orphelins indéfiniment.
   */
  async purgeStalePendingAssets(): Promise<void> {
    const staleBefore = new Date(Date.now() - UPLOAD_URL_EXPIRY_SECONDS * 1000);
    const staleAssets = await this.prisma.mediaAsset.findMany({
      where: { status: MediaStatus.PENDING, createdAt: { lt: staleBefore } },
    });

    for (const asset of staleAssets) {
      try {
        await this.deleteObject(asset.storageKey);
      } catch (error) {
        this.logger.warn(
          `Échec de la suppression du binaire orphelin ${asset.storageKey} : ${error}`,
        );
      }
      await this.prisma.mediaAsset.delete({ where: { id: asset.id } });
    }

    if (staleAssets.length > 0) {
      this.logger.log(
        `${staleAssets.length} média(s) PENDING jamais confirmé(s) purgé(s).`,
      );
    }
  }

  async findOne(id: string): Promise<MediaAssetDto> {
    const asset = await this.getAssetOrThrow(id);
    const dto = this.toDto(asset);

    if (asset.status === MediaStatus.READY) {
      dto.downloadUrl = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: asset.storageKey }),
        { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS },
      );
    }

    return dto;
  }

  async findAll(query: ListMediaDto): Promise<MediaAssetDto[]> {
    const assets = await this.prisma.mediaAsset.findMany({
      where: {
        ...(query.ownerId ? { ownerId: query.ownerId } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.take,
      skip: query.skip,
    });

    return assets.map((asset) => this.toDto(asset));
  }

  async remove(id: string): Promise<void> {
    const asset = await this.getAssetOrThrow(id);
    await this.deleteObject(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id } });
  }

  /** Métadonnées réelles du binaire, ou `null` s'il n'a jamais été déposé. */
  private async headObject(key: string) {
    try {
      return await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  private async deleteObject(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private async getAssetOrThrow(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Média introuvable : ${id}`);
    }
    return asset;
  }

  private toDto(asset: {
    id: string;
    ownerId: string;
    fileName: string;
    kind: MediaAssetDto['kind'];
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    status: MediaAssetDto['status'];
    createdAt: Date;
    updatedAt: Date;
  }): MediaAssetDto {
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      fileName: asset.fileName,
      kind: asset.kind,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      status: asset.status,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }
}
