import {
  IsByteLength,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeEmail, trimString } from '../../common/normalize';

// bcrypt ignore silencieusement tout ce qui dépasse 72 octets (cf. ADR 0007).
// La limite est vérifiée en octets UTF-8 et non en caractères : un caractère
// accentué pèse 2 octets, un emoji 4, donc 64 caractères peuvent dépasser 72
// octets.
const PASSWORD_MAX_BYTES = 72;

const NAME_MAX_LENGTH = 100;

export class CreateUserDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jane', minLength: 2, maxLength: NAME_MAX_LENGTH })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(NAME_MAX_LENGTH)
  firstName!: string;

  @ApiProperty({ example: 'Doe', minLength: 2, maxLength: NAME_MAX_LENGTH })
  @Transform(({ value }) => trimString(value))
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
  @Transform(({ value }) => trimString(value))
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
