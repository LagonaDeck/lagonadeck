import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeEmail, normalizePseudo } from '../../common/normalize';

// bcrypt ignore silencieusement tout ce qui dépasse 72 octets (cf. ADR 0007) :
// une longueur max explicite évite qu'un mot de passe plus long soit tronqué
// sans que l'utilisateur ne s'en rende compte. 64 caractères garde une marge
// sous 72 octets même avec des caractères multi-octets (UTF-8).
const PASSWORD_MAX_LENGTH = 64;

export class CreateUserDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({ example: 'janedoe' })
  @Transform(({ value }) => normalizePseudo(value))
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  pseudo!: string;

  @ApiProperty({
    example: 'Str0ng!Password',
    minLength: 8,
    maxLength: PASSWORD_MAX_LENGTH,
    description:
      'Au moins 8 caractères, une majuscule, une minuscule et un chiffre ou caractère spécial.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).+$/, {
    message: 'Mot de passe trop faible',
  })
  password!: string;
}
