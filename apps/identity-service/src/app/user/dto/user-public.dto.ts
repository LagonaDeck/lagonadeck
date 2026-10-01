import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../../generated/prisma/client';

/**
 * Vue d'un utilisateur lisible par un tiers : ni email, ni hash, ni salt.
 * L'email reste une donnée personnelle ; il ne sera renvoyé qu'à l'utilisateur
 * lui-même, par un endpoint dédié une fois l'authentification en place.
 */
export class UserPublicDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  pseudo!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(user: User): UserPublicDto {
    const dto = new UserPublicDto();
    dto.id = user.id;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.pseudo = user.pseudo;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
