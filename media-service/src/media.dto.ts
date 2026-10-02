import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MediaKind, MediaStatus } from './generated/prisma/enums';
import { ALLOWED_CONTENT_TYPES } from './media.constants';

export class RequestUploadDto {
  @ApiProperty({
    description:
      'Identifiant du propriétaire du fichier (utilisateur ou service appelant).',
    example: 'a3f1c2d4-5b6a-4e7f-8c9d-0e1f2a3b4c5d',
  })
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({
    description: "Nom de fichier original, tel qu'envoyé par le client.",
    example: 'facture-2026-09.pdf',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    description: 'Type MIME du fichier à téléverser.',
    enum: ALLOWED_CONTENT_TYPES,
    example: 'application/pdf',
  })
  @IsString()
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: string;

  @ApiProperty({
    description:
      'Taille annoncée du fichier en octets (vérifiée après upload).',
    example: 204800,
  })
  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}

export class RequestUploadResponseDto {
  @ApiProperty({
    description:
      'Identifiant du média, à conserver pour référencer ce fichier plus tard (ex. depuis un autre service).',
  })
  id!: string;

  @ApiProperty({
    description:
      "URL cible du POST multipart/form-data à effectuer directement vers l'object storage.",
  })
  uploadUrl!: string;

  @ApiProperty({
    description:
      'Champs à envoyer tels quels dans le formulaire multipart, avant le champ `file` (qui doit être le dernier). ' +
      "Ils figent notamment le Content-Type et la taille exacte annoncés : l'upload est rejeté par l'object storage " +
      'si le fichier envoyé ne correspond pas exactement à ce qui a été déclaré.',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      'Content-Type': 'application/pdf',
      bucket: 'lagonadeck-media',
      key: 'document/owner-1/85cf5d17-.../85cf5d17-...',
      Policy: '...',
      'X-Amz-Signature': '...',
    },
  })
  uploadFields!: Record<string, string>;

  @ApiProperty({ description: "Durée de validité de l'URL, en secondes." })
  expiresInSeconds!: number;
}

export class ListMediaDto {
  @ApiPropertyOptional({ description: 'Filtre sur le propriétaire du média.' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    enum: MediaKind,
    description: 'Filtre sur la nature du média.',
  })
  @IsOptional()
  @IsEnum(MediaKind)
  kind?: MediaKind;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}

export class MediaAssetDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty({ enum: MediaKind })
  kind!: MediaKind;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ required: false, nullable: true })
  width!: number | null;

  @ApiProperty({ required: false, nullable: true })
  height!: number | null;

  @ApiProperty({ enum: MediaStatus })
  status!: MediaStatus;

  @ApiProperty({
    required: false,
    description:
      'URL pré-signée de téléchargement, présente uniquement quand le média est prêt (READY).',
  })
  downloadUrl?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
