import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ALLOWED_CONTENT_TYPES } from '../media.constants';

export class RequestUploadDto {
  @ApiProperty({
    description:
      'Identifiant du propriétaire du fichier (utilisateur ou service appelant).',
    example: 'a3f1c2d4-5b6a-4e7f-8c9d-0e1f2a3b4c5d',
  })
  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @ApiProperty({
    description: "Nom de fichier original, tel qu'envoyé par le client.",
    example: 'facture-2026-09.pdf',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    description: 'Type MIME du fichier à téléverser.',
    enum: ALLOWED_CONTENT_TYPES,
    example: 'application/pdf',
  })
  @IsString()
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType: string;

  @ApiProperty({
    description:
      'Taille annoncée du fichier en octets (vérifiée après upload).',
    example: 204800,
  })
  @IsInt()
  @IsPositive()
  sizeBytes: number;
}
