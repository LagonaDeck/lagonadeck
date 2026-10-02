import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { User } from './generated/prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Limite historique de bcrypt, gardée pour ne pas changer le contrat
// de l'API. Elle se mesure en octets UTF-8 : un accent pèse 2 octets, un emoji 4.
const PASSWORD_MAX_BYTES = 72;

const NAME_MAX_LENGTH = 100;

export class CreateUserDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jane', minLength: 2, maxLength: NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(NAME_MAX_LENGTH)
  firstName!: string;

  @ApiProperty({ example: 'Doe', minLength: 2, maxLength: NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(NAME_MAX_LENGTH)
  lastName!: string;

  @ApiProperty({
    example: 'JaneDoe',
    minLength: 3,
    maxLength: 30,
    description:
      'Lettres non accentuées, chiffres, « . », « _ » et « - ». La casse est conservée ; l’unicité, elle, ne tient pas compte de la casse.',
  })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'Pseudo invalide : lettres, chiffres, « . », « _ » et « - »',
  })
  pseudo!: string;

  @ApiProperty({
    example: 'Str0ng!Password',
    minLength: 8,
    description:
      'Au moins 8 caractères et au plus 72 octets UTF-8, une majuscule, une minuscule et un chiffre ou caractère spécial.',
  })
  @IsString()
  @MinLength(8)
  @IsByteLength(0, PASSWORD_MAX_BYTES, {
    message: `Mot de passe trop long (${PASSWORD_MAX_BYTES} octets maximum)`,
  })
  // Classes Unicode (flag `u`) : sans elles, `\W` compte les lettres accentuées
  // comme des caractères spéciaux.
  @Matches(/^(?=.*\p{Ll})(?=.*\p{Lu})(?=.*[\p{N}\p{P}\p{S}]).+$/u, {
    message: 'Mot de passe trop faible',
  })
  password!: string;
}

// Le mot de passe se changera par un endpoint dédié, pas par une mise à jour.
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}

/** Vue d'un utilisateur lisible par un tiers : ni email, ni hash, ni salt. */
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
