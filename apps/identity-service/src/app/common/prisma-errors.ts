import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

/** Code Prisma d'une violation de contrainte unique. */
const UNIQUE_CONSTRAINT_VIOLATION_CODE = 'P2002';
/** Code Prisma d'un enregistrement introuvable lors d'une écriture. */
const RECORD_NOT_FOUND_CODE = 'P2025';

/**
 * Traduit P2002 en 409 et P2025 en 404. Pas de pré-contrôle applicatif : il ne
 * serait pas atomique avec l'écriture, la base reste la source de vérité.
 */
export async function writeOrConflict<T>(
  write: () => Promise<T>,
  messages: { conflict?: string; notFound?: string },
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (
        error.code === UNIQUE_CONSTRAINT_VIOLATION_CODE &&
        messages.conflict
      ) {
        throw new ConflictException(messages.conflict);
      }
      if (error.code === RECORD_NOT_FOUND_CODE && messages.notFound) {
        throw new NotFoundException(messages.notFound);
      }
    }
    throw error;
  }
}
