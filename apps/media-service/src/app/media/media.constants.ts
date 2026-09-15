import { MediaKind } from '../../generated/prisma/enums';

/** Types MIME acceptés pour les images. */
export const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

/** Types MIME acceptés pour les documents. */
export const DOCUMENT_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
] as const;

export const ALLOWED_CONTENT_TYPES = [
  ...IMAGE_CONTENT_TYPES,
  ...DOCUMENT_CONTENT_TYPES,
];

/** Taille maximale acceptée pour un upload, configurable via l'environnement. */
export const MAX_UPLOAD_SIZE_BYTES = Number(
  process.env.MEDIA_MAX_UPLOAD_SIZE_BYTES ?? 25 * 1024 * 1024,
);

/** Durées de validité par défaut des URLs pré-signées. */
export const UPLOAD_URL_EXPIRY_SECONDS = 900;
export const DOWNLOAD_URL_EXPIRY_SECONDS = 900;

/** Déduit la nature (image/document) d'un fichier à partir de son type MIME. */
export function resolveMediaKind(contentType: string): MediaKind | null {
  if ((IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return MediaKind.IMAGE;
  }
  if ((DOCUMENT_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return MediaKind.DOCUMENT;
  }
  return null;
}
