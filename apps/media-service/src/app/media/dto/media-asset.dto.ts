import { ApiProperty } from '@nestjs/swagger';
import { MediaKind, MediaStatus } from '../../../generated/prisma/enums';

export class MediaAssetDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ownerId: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty({ enum: MediaKind })
  kind: MediaKind;

  @ApiProperty()
  contentType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty({ required: false, nullable: true })
  width: number | null;

  @ApiProperty({ required: false, nullable: true })
  height: number | null;

  @ApiProperty({ enum: MediaStatus })
  status: MediaStatus;

  @ApiProperty({
    required: false,
    description:
      'URL pré-signée de téléchargement, présente uniquement quand le média est prêt (READY).',
  })
  downloadUrl?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
