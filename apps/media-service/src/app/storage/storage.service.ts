import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StoredObjectInfo {
  contentType?: string;
  sizeBytes: number;
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

  /** URL pré-signée pour téléverser un binaire (PUT). */
  presignUpload(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
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
