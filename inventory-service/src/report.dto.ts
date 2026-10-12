import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ReportStatus } from './generated/prisma/enums';
import { ProductDto } from './product.dto';

export class CreateReportDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Produit concerné ; absent pour signaler un produit manquant.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({
    example: 'Le prix correspond à la version reverse, pas à la carte normale.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}

export class ListReportsDto {
  @ApiPropertyOptional({ enum: ReportStatus, default: ReportStatus.OPEN })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus = ReportStatus.OPEN;
}

export class UpdateReportDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status!: ReportStatus;
}

export class ReportDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: ProductDto, nullable: true })
  product!: ProductDto | null;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: ReportStatus })
  status!: ReportStatus;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true, type: Date })
  resolvedAt!: Date | null;
}
