import { User } from '../../../generated/prisma/client';

export class UserPublicDto {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  pseudo!: string;
  createdAt!: Date;

  static fromEntity(user: User): UserPublicDto {
    const dto = new UserPublicDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.pseudo = user.pseudo;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
