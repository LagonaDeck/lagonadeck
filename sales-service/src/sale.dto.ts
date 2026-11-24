import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const MAX_AMOUNT = 1_000_000_000;
const AMOUNT = { maxDecimalPlaces: 2 };
// Les exemplaires sortent du stock en une seule requête à inventory.
const MAX_ITEMS = 100;

// Contrairement à @IsOptional(), refuse null : un null remplacerait la valeur
// par défaut sans être validé.
const IsOmittable = () => ValidateIf((_, value) => value !== undefined);

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Une date-heure avec fuseau changerait de jour dans la colonne DATE.
const IsDay = (property: string) =>
  applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: `${property} doit être au format AAAA-MM-JJ`,
    }),
    IsISO8601({ strict: true }),
  );

export class SaleLineInputDto {
  @ApiProperty({ format: 'uuid', description: 'Exemplaire du stock vendu.' })
  @IsUUID()
  inventoryItemId!: string;

  @ApiPropertyOptional({
    example: 25,
    description:
      'Prix de l’exemplaire en EUR. Sans prix, il reçoit une part du reste de la vente, au prorata de son Price Trend.',
  })
  @IsOmittable()
  @IsNumber(AMOUNT)
  @Min(0)
  @Max(MAX_AMOUNT)
  unitPrice?: number;
}

export class CreateSaleDto {
  @ApiProperty({ example: 'Cardmarket', description: 'Acheteur ou canal.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  buyer!: string;

  @ApiProperty({ format: 'date', example: '2026-11-24' })
  @IsDay('soldAt')
  soldAt!: string;

  @ApiProperty({ example: 80, description: 'Prix encaissé en EUR.' })
  @IsNumber(AMOUNT)
  @Min(0)
  @Max(MAX_AMOUNT)
  price!: number;

  @ApiPropertyOptional({
    default: 0,
    example: 4.5,
    description: 'Commission et port payés en EUR.',
  })
  @IsOmittable()
  @IsNumber(AMOUNT)
  @Min(0)
  @Max(MAX_AMOUNT)
  fees: number = 0;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [SaleLineInputDto] })
  @ValidateNested({ each: true })
  @Type(() => SaleLineInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS)
  @ArrayUnique(({ inventoryItemId }: SaleLineInputDto) => inventoryItemId, {
    message: 'Un exemplaire ne figure qu’une fois dans une vente',
  })
  lines!: SaleLineInputDto[];
}

export class ListSalesDto {
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

export class SalesSummaryQueryDto {
  @ApiPropertyOptional({ format: 'date', description: 'Premier jour inclus.' })
  @IsOptional()
  @IsDay('from')
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Dernier jour inclus.' })
  @IsOptional()
  @IsDay('to')
  to?: string;
}

export class SaleLineDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Exemplaire d’inventory.' })
  inventoryItemId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  productType!: string;

  @ApiProperty({ type: String, nullable: true })
  setCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  setName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cardNumber!: string | null;

  @ApiProperty({ type: String, nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  condition!: string | null;

  @ApiProperty({ type: String, nullable: true })
  language!: string | null;

  @ApiProperty({ type: String, nullable: true })
  gradingCompany!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 9.5 })
  grade!: number | null;

  @ApiProperty()
  reverse!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '23.21',
    description: 'Price Trend Cardmarket en EUR le jour de la vente.',
  })
  marketPrice!: string | null;

  @ApiProperty({
    type: String,
    example: '25.00',
    description: 'Part du prix de la vente, en EUR.',
  })
  price!: string;

  @ApiProperty({
    type: String,
    example: '1.40',
    description: 'Part des frais, au prorata du prix, en EUR.',
  })
  fees!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '18.40',
    description: 'Coût d’achat en EUR, null hors achat.',
  })
  cost!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '5.20',
    description: 'Prix moins frais et coût, null sans coût.',
  })
  margin!: string | null;
}

export class SaleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  buyer!: string;

  @ApiProperty({ format: 'date', example: '2026-11-24' })
  soldAt!: string;

  @ApiProperty({ type: String, example: '80.00' })
  price!: string;

  @ApiProperty({ type: String, example: '4.50' })
  fees!: string;

  @ApiProperty({
    type: String,
    example: '75.50',
    description: 'Prix moins frais : ce que la vente rapporte.',
  })
  revenue!: string;

  @ApiProperty({
    type: String,
    example: '52.00',
    description: 'Somme des coûts d’achat connus.',
  })
  cost!: string;

  @ApiProperty({
    type: String,
    example: '20.10',
    description: 'Marge des exemplaires dont le coût est connu.',
  })
  margin!: string;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty({ description: 'Exemplaires sans coût d’achat, hors marge.' })
  uncostedItemCount!: number;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class SaleDetailDto extends SaleDto {
  @ApiProperty({ type: [SaleLineDto] })
  lines!: SaleLineDto[];
}

export class SalesSummaryDto {
  @ApiProperty()
  saleCount!: number;

  @ApiProperty({ description: 'Exemplaires vendus.' })
  itemCount!: number;

  @ApiProperty({
    type: String,
    example: '2480.00',
    description: 'Prix moins frais, en EUR.',
  })
  revenue!: string;

  @ApiProperty({
    type: String,
    example: '1640.00',
    description: 'Coûts d’achat connus, en EUR.',
  })
  cost!: string;

  @ApiProperty({
    type: String,
    example: '610.00',
    description: 'Marge des exemplaires dont le coût est connu, en EUR.',
  })
  margin!: string;

  @ApiProperty({ description: 'Exemplaires sans coût d’achat, hors marge.' })
  uncostedItemCount!: number;
}
