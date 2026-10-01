import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// On exclut le mot de passe : la mise à jour du mot de passe
// doit passer par un endpoint dédié (change-password), pas ici.
// PartialType/OmitType viennent de @nestjs/swagger plutôt que de
// @nestjs/mapped-types : ils copient aussi les métadonnées Swagger (et,
// comme @nestjs/mapped-types, les décorateurs class-validator/class-transformer).
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}
