import { Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
}
