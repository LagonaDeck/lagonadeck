import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Permission, PrismaClient } from '../generated/prisma/client';

export const ALL_PERMISSIONS = Object.values(Permission);

// Seul point de contrôle d'accès aux organisations : chaque opération d'une
// organisation l'appelle avant de lire ou d'écrire.
@Injectable()
export class OrganizationAccessService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  // Un non-membre reçoit 404 et non 403 : il n'apprend pas que l'organisation existe.
  async getPermissions(
    userId: string,
    organizationId: string,
  ): Promise<Permission[]> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: {
        groups: {
          select: { group: { select: { isOwner: true, permissions: true } } },
        },
      },
    });
    if (!member) throw new NotFoundException('Organisation introuvable');

    const groups = member.groups.map(({ group }) => group);
    if (groups.some((group) => group.isOwner)) return ALL_PERMISSIONS;
    return [...new Set(groups.flatMap((group) => group.permissions))];
  }

  async requirePermission(
    userId: string,
    organizationId: string,
    permission: Permission,
  ): Promise<void> {
    const permissions = await this.getPermissions(userId, organizationId);
    if (!permissions.includes(permission)) {
      throw new ForbiddenException('Permission insuffisante');
    }
  }

  // Réservé au propriétaire, pas à une permission : un groupe peut tout avoir
  // sans être le groupe Owner.
  async requireOwner(userId: string, organizationId: string): Promise<void> {
    await this.getPermissions(userId, organizationId);
    const ownership = await this.prisma.groupMember.findFirst({
      where: { organizationId, userId, group: { isOwner: true } },
      select: { groupId: true },
    });
    if (!ownership) {
      throw new ForbiddenException('Réservé au propriétaire de l’organisation');
    }
  }
}
