import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Condition, GradingCompany, Language } from './generated/prisma/enums';
import { ProductDto } from './product.dto';

// De 1 à 10 par demi-point, l'échelle commune des sociétés de gradation.
export const GRADES = Array.from({ length: 19 }, (_, index) => 1 + index / 2);

export class AddInventoryItemDto {
  @ApiProperty({ format: 'uuid', description: 'Produit du catalogue global.' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ enum: Condition })
  @IsOptional()
  @IsEnum(Condition)
  condition?: Condition;

  @ApiProperty({ enum: Language })
  @IsEnum(Language)
  language!: Language;

  @ApiPropertyOptional({
    enum: GradingCompany,
    description: 'Carte gradée uniquement, avec `grade` et sans `condition`.',
  })
  @IsOptional()
  @IsEnum(GradingCompany)
  gradingCompany?: GradingCompany;

  @ApiPropertyOptional({ enum: GRADES, example: 9.5 })
  @IsOptional()
  @IsIn(GRADES)
  grade?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Carte à l’unité en version reverse.',
  })
  @IsOptional()
  @IsBoolean()
  reverse?: boolean;
}

export class ListInventoryDto {
  @ApiPropertyOptional({
    description: 'Partie du nom du produit, sans tenir compte de la casse.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  search?: string;

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

export class InventoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: Condition, nullable: true })
  condition!: Condition | null;

  @ApiProperty({ enum: Language, nullable: true })
  language!: Language | null;

  @ApiProperty({ enum: GradingCompany, nullable: true })
  gradingCompany!: GradingCompany | null;

  @ApiProperty({ type: Number, nullable: true, example: 9.5 })
  grade!: number | null;

  @ApiProperty()
  reverse!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '23.21',
    description:
      'Prix unitaire en EUR : Price Trend Cardmarket, celui de la reverse pour une reverse. `null` sans prix ou pour une carte gradée.',
  })
  price!: string | null;

  @ApiProperty({ type: ProductDto })
  product!: ProductDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class InventorySummaryDto {
  @ApiProperty({ description: 'Nombre d’exemplaires du stock.' })
  itemCount!: number;

  @ApiProperty({
    type: String,
    example: '3247.36',
    description:
      'Valeur du stock en EUR au Price Trend Cardmarket (celui de la reverse pour une reverse), sans les exemplaires de `unpricedItemCount`.',
  })
  value!: string;

  @ApiProperty({
    description:
      'Exemplaires absents de `value` : produit sans prix Cardmarket, ou carte gradée (le Price Trend vaut pour une carte brute).',
  })
  unpricedItemCount!: number;
}
