import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsISO8601,
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

// Contrairement à @IsOptional(), refuse null : un null remplacerait la valeur
// par défaut sans être validé.
const IsOmittable = () => ValidateIf((_, value) => value !== undefined);

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// L'état, la langue et la gradation sont validés par inventory, qui crée
// l'exemplaire : leurs valeurs n'y sont définies qu'une fois.
export class PurchaseLineInputDto {
  @ApiProperty({ format: 'uuid', description: 'Produit du catalogue global.' })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: 'NEAR_MINT' })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiProperty({ example: 'FRENCH' })
  @IsString()
  language!: string;

  @ApiPropertyOptional({ example: 'PSA' })
  @IsOptional()
  @IsString()
  gradingCompany?: string;

  @ApiPropertyOptional({ example: 9.5 })
  @IsOptional()
  @IsNumber()
  grade?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  reverse?: boolean;

  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    maximum: 100,
    description: 'Chaque unité devient un exemplaire du stock.',
  })
  @IsOmittable()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number = 1;

  @ApiPropertyOptional({
    example: 12.5,
    description:
      'Coût de chaque unité en EUR. Sans coût, l’unité reçoit une part du reste du lot, au prorata de son Price Trend.',
  })
  @IsOmittable()
  @IsNumber(AMOUNT)
  @Min(0)
  @Max(MAX_AMOUNT)
  unitCost?: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ example: 'Vinted', description: 'Vendeur ou lieu d’achat.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  supplier!: string;

  @ApiProperty({ format: 'date', example: '2026-10-13' })
  // Une date-heure avec fuseau changerait de jour dans la colonne DATE.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'purchasedAt doit être au format AAAA-MM-JJ',
  })
  @IsISO8601({ strict: true })
  purchasedAt!: string;

  @ApiProperty({ example: 120, description: 'Prix payé en EUR, hors frais.' })
  @IsNumber(AMOUNT)
  @Min(0)
  @Max(MAX_AMOUNT)
  price!: number;

  @ApiPropertyOptional({
    default: 0,
    example: 6.5,
    description: 'Port et commissions en EUR.',
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

  @ApiProperty({ type: [PurchaseLineInputDto] })
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  lines!: PurchaseLineInputDto[];
}

export class ListPurchasesDto {
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

export class PurchaseLineDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Exemplaire d’inventory.' })
  inventoryItemId!: string;

  @ApiProperty({
    description:
      'Faux quand l’exemplaire a été retiré du stock depuis l’achat : la ligne garde son produit et son coût.',
  })
  inStock!: boolean;

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
    description: 'Price Trend Cardmarket en EUR le jour de l’achat.',
  })
  marketPrice!: string | null;

  @ApiProperty({
    type: String,
    example: '18.40',
    description: 'Part du lot, frais compris, en EUR.',
  })
  cost!: string;
}

export class PurchaseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  supplier!: string;

  @ApiProperty({ format: 'date', example: '2026-10-13' })
  purchasedAt!: string;

  @ApiProperty({ type: String, example: '120.00' })
  price!: string;

  @ApiProperty({ type: String, example: '6.50' })
  fees!: string;

  @ApiProperty({
    type: String,
    example: '126.50',
    description: 'Prix et frais : la somme des coûts des exemplaires.',
  })
  totalCost!: string;

  @ApiProperty({
    type: String,
    example: '154.20',
    description:
      'Somme des Price Trend le jour de l’achat, sans les exemplaires sans prix.',
  })
  marketValue!: string;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PurchaseDetailDto extends PurchaseDto {
  @ApiProperty({ type: [PurchaseLineDto] })
  lines!: PurchaseLineDto[];
}

export class PurchasesSummaryDto {
  @ApiProperty()
  purchaseCount!: number;

  @ApiProperty({ description: 'Exemplaires achetés.' })
  itemCount!: number;

  @ApiProperty({
    type: String,
    example: '2480.00',
    description: 'Total dépensé en EUR, frais compris.',
  })
  totalCost!: string;
}

export class PurchasedItemDto {
  @ApiProperty({ format: 'uuid' })
  purchaseId!: string;

  @ApiProperty()
  supplier!: string;

  @ApiProperty({ format: 'date', example: '2026-10-13' })
  purchasedAt!: string;

  @ApiProperty({ type: String, example: '18.40' })
  cost!: string;
}
