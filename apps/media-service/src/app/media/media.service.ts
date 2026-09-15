import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MediaStatus } from '../../generated/prisma/enums';
import { RequestUploadDto } from './dto/request-upload.dto';
import { RequestUploadResponseDto } from './dto/request-upload-response.dto';
import { ListMediaDto } from './dto/list-media.dto';
import { MediaAssetDto } from './dto/media-asset.dto';
import {
  DOWNLOAD_URL_EXPIRY_SECONDS,
  MAX_UPLOAD_SIZE_BYTES,
  UPLOAD_URL_EXPIRY_SECONDS,
  resolveMediaKind,
} from './media.constants';

/** Tolérance acceptée entre la taille annoncée et la taille réelle de l'objet uploadé. */
const SIZE_MISMATCH_TOLERANCE_BYTES = 0;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

    const uploadUrl = await this.storage.presignUpload(
      storageKey,
      UPLOAD_URL_EXPIRY_SECONDS,
    );

    return { id, uploadUrl, expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS };
  }

  async confirmUpload(id: string): Promise<MediaAssetDto> {
    const asset = await this.getAssetOrThrow(id);

    const objectInfo = await this.storage.statObject(asset.storageKey);
    if (!objectInfo) {
      await this.prisma.mediaAsset.update({
        where: { id },
        data: { status: MediaStatus.FAILED },
      });
      throw new UnprocessableEntityException(
        "Aucun binaire trouvé sur l'object storage pour ce média : l'upload n'a pas abouti.",
      );
    }

    const sizeDelta = Math.abs(objectInfo.sizeBytes - asset.sizeBytes);
    if (sizeDelta > SIZE_MISMATCH_TOLERANCE_BYTES) {
      await this.prisma.mediaAsset.update({
        where: { id },
        data: { status: MediaStatus.FAILED },
      });
      throw new UnprocessableEntityException(
        'La taille du binaire uploadé ne correspond pas à la taille annoncée.',
      );
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: { status: MediaStatus.READY, sizeBytes: objectInfo.sizeBytes },
    });

    return this.toDto(updated);
  }

  async findOne(id: string): Promise<MediaAssetDto> {
    const asset = await this.getAssetOrThrow(id);
    const dto = this.toDto(asset);

    if (asset.status === MediaStatus.READY) {
      dto.downloadUrl = await this.storage.presignDownload(
        asset.storageKey,
        DOWNLOAD_URL_EXPIRY_SECONDS,
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
    await this.storage.deleteObject(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id } });
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
