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

const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Taille maximale acceptée pour un upload, configurable via l'environnement.
 * Retombe sur la valeur par défaut si `MEDIA_MAX_UPLOAD_SIZE_BYTES` est absente,
 * vide ou invalide, pour éviter de désactiver silencieusement la limite (NaN)
 * ou de tout bloquer (chaîne vide → 0).
 */
function parseMaxUploadSizeBytes(): number {
  const raw = process.env.MEDIA_MAX_UPLOAD_SIZE_BYTES;
  if (!raw) {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }
  return parsed;
}

export const MAX_UPLOAD_SIZE_BYTES = parseMaxUploadSizeBytes();

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
