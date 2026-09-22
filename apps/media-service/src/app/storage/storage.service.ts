import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

export interface StoredObjectInfo {
  contentType?: string;
  sizeBytes: number;
}

export interface PresignedUpload {
  /** URL cible du POST multipart/form-data. */
  url: string;
  /** Champs de formulaire à envoyer tels quels avant le champ `file`. */
  fields: Record<string, string>;
}

/**
 * Accès à l'object storage (MinIO en local, S3 en prod) pour les binaires média.
 * Les octets ne transitent jamais par la base : on stocke seulement la clé
 * (storageKey) dans Prisma et on sert des URLs pré-signées aux clients.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.MEDIA_S3_BUCKET ?? 'lagonadeck-media';
    this.client = new S3Client({
      endpoint: process.env.MEDIA_S3_ENDPOINT,
      region: process.env.MEDIA_S3_REGION ?? 'us-east-1',
      forcePathStyle: process.env.MEDIA_S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY ?? '',
      },
    });
  }

  /**
   * POST pré-signé (formulaire multipart) pour téléverser un binaire.
   *
   * Contrairement à un PUT pré-signé, un POST S3 signé via une policy permet
   * de figer le `Content-Type` et la taille exacte du fichier dans la
   * signature elle-même : l'en-tête `Content-Type` d'un PUT présigné n'est
   * jamais inclus dans le calcul de signature par le SDK AWS (il est marqué
   * "unsignable"), donc un client pourrait y envoyer n'importe quel binaire
   * sous n'importe quel type. Ici, S3/MinIO rejette la requête (403/400) si
   * le `Content-Type` ou la taille du corps ne correspondent pas exactement
   * à ce qui a été annoncé lors de la demande d'upload.
   */
  presignUpload(
    key: string,
    contentType: string,
    sizeBytes: number,
    expiresInSeconds = 900,
  ): Promise<PresignedUpload> {
    return createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresInSeconds,
      Conditions: [
        ['content-length-range', sizeBytes, sizeBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: {
        'Content-Type': contentType,
      },
    });
  }

  /** URL pré-signée pour télécharger un binaire (GET). */
  presignDownload(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  /**
   * Vérifie qu'un binaire a bien été déposé et renvoie ses métadonnées réelles.
   * Renvoie `null` si l'objet n'existe pas (upload jamais confirmé côté client).
   */
  async statObject(key: string): Promise<StoredObjectInfo | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        contentType: head.ContentType,
        sizeBytes: head.ContentLength ?? 0,
      };
    } catch (error) {
      if (error instanceof NotFound) {
        return null;
      }
      throw error;
    }
  }

  /** Supprime un binaire de l'object storage. */
  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
