import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// On exclut le mot de passe : la mise à jour du mot de passe
// doit passer par un endpoint dédié (change-password), pas ici.
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}