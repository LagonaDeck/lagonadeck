import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MediaKind } from '../../../generated/prisma/enums';

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
