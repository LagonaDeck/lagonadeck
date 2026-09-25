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

/**
 * Lit un entier positif depuis l'environnement, en retombant sur `fallback`
 * si la variable est absente, vide ou invalide — pour éviter de désactiver
 * silencieusement une limite (NaN) ou de tout bloquer (chaîne vide → 0).
 */
function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

/** Taille maximale acceptée pour un upload, configurable via l'environnement. */
export const MAX_UPLOAD_SIZE_BYTES = parsePositiveIntEnv(
  'MEDIA_MAX_UPLOAD_SIZE_BYTES',
  25 * 1024 * 1024,
);

/** Durées de validité par défaut des URLs pré-signées. */
export const UPLOAD_URL_EXPIRY_SECONDS = 900;
export const DOWNLOAD_URL_EXPIRY_SECONDS = 900;

/**
 * Intervalle du job qui purge les médias PENDING dont l'URL d'upload a
 * expiré sans jamais avoir été confirmée (client interrompu, upload jamais
 * tenté...). Configurable via l'environnement.
 */
export const PENDING_CLEANUP_INTERVAL_MS = parsePositiveIntEnv(
  'MEDIA_PENDING_CLEANUP_INTERVAL_MS',
  5 * 60 * 1000,
);

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
