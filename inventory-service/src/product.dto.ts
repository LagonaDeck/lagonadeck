import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ProductSource, ProductType } from './generated/prisma/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SearchProductsDto {
  @ApiPropertyOptional({
    description:
      'Mots du nom (français ou anglais), du set ou du numéro, dans n’importe quel ordre : « Mewtwo EX BKT 158 ». Accents et fautes de frappe tolérés.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  search?: string;

  @ApiPropertyOptional({ enum: ProductType })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

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

export class CreateProductDto {
  @ApiProperty({ example: 'Pikachu' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  productType!: ProductType;

  @ApiPropertyOptional({ example: 'MEW' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  setCode?: string;

  @ApiPropertyOptional({ example: '151' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  setName?: string;

  @ApiPropertyOptional({ example: '025' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  cardNumber?: string;

  @ApiPropertyOptional({ example: 'Rare' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  rarity?: string;
}

export class LinkCardmarketDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 286307,
    description:
      '`idProduct` Cardmarket du produit ; `null` pour retirer un lien faux. Le lien saisi n’est plus remplacé par la synchronisation.',
  })
  @ValidateIf((dto: LinkCardmarketDto) => dto.cardmarketId !== null)
  @IsInt()
  @Min(1)
  cardmarketId!: number | null;
}

export class PriceDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: '279.10',
    description:
      'Price Trend Cardmarket en EUR : une référence pour le produit, pas une estimation par état ou langue. `null` sans lien Cardmarket ou sans prix publié.',
  })
  price!: string | null;

  @ApiProperty({
    nullable: true,
    type: Date,
    description: 'Date de calcul du prix par Cardmarket (UTC).',
  })
  priceUpdatedAt!: Date | null;
}

export class CardmarketDto {
  @ApiProperty({ description: '`idProduct` Cardmarket.' })
  id!: number;

  @ApiProperty({ description: 'Nom du produit chez Cardmarket.' })
  name!: string;

  @ApiProperty({ example: 'Pokémon Single' })
  categoryName!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Price Trend.' })
  trend!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Prix le plus bas (« à partir de »).',
  })
  low!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Moyenne 1 jour.' })
  avg1!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Moyenne 7 jours.',
  })
  avg7!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Moyenne 30 jours.',
  })
  avg30!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Price Trend de la version reverse ou holo.',
  })
  trendHolo!: string | null;

  @ApiProperty({ nullable: true, type: Date })
  priceDate!: Date | null;
}

export class ProductDto extends PriceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ProductSource })
  source!: ProductSource;

  @ApiProperty({ enum: ProductType })
  productType!: ProductType;

  @ApiProperty({ nullable: true, type: String, example: 'en/sv03.5-006' })
  tcgdexId!: string | null;

  @ApiProperty({ description: 'Nom en français quand la source le donne.' })
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  englishName!: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'BKT' })
  setCode!: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'Impulsion Turbo' })
  setName!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '158' })
  cardNumber!: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'Ultra Rare' })
  rarity!: string | null;

  @ApiProperty({ nullable: true, type: String })
  imageUrl!: string | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description:
      'Existe en reverse, selon TCGdex ; `null` si TCGdex ne le précise pas.',
  })
  hasReverse!: boolean | null;

  @ApiProperty({
    type: [String],
    description: 'Talents et attaques, en anglais.',
  })
  moves!: string[];

  @ApiProperty({ type: CardmarketDto, nullable: true })
  cardmarket!: CardmarketDto | null;

  @ApiProperty({ description: 'Lien Cardmarket saisi par un utilisateur.' })
  cardmarketLinkedByUser!: boolean;
}

export class PricePointDto {
  @ApiProperty({ example: '2026-10-12', description: 'Jour du relevé (UTC).' })
  date!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Price Trend.' })
  trend!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Prix le plus bas (« à partir de »).',
  })
  low!: string | null;
}
