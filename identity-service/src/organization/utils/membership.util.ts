import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

export const MAX_ORGANIZATIONS_PER_USER = 3;

export async function assertCanJoinOrganization(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  // Le verrou sérialise les adhésions simultanées d'un même utilisateur :
  // sans lui, deux acceptations pourraient chacune compter 2 et dépasser la limite.
  await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  const memberships = await tx.organizationMember.count({ where: { userId } });
  if (memberships >= MAX_ORGANIZATIONS_PER_USER) {
    throw new ConflictException(
      `Vous faites déjà partie de ${MAX_ORGANIZATIONS_PER_USER} organisations, le maximum`,
    );
  }
}
