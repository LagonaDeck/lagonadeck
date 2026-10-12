import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateProductDto,
  LinkCardmarketDto,
  PriceDto,
  PricePointDto,
  ProductDto,
  SearchProductsDto,
} from './product.dto';
import { ProductService } from './product.service';

@ApiTags('products')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Session invalide.' })
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Recherche dans le catalogue global.' })
  @ApiResponse({ status: 200, type: [ProductDto] })
  search(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: SearchProductsDto,
  ): Promise<ProductDto[]> {
    return this.productService.search(authorization, query);
  }

  @Post()
  @ApiOperation({
    summary:
      'Ajoute au catalogue un produit absent des sources (équipe LagonaDeck).',
    description:
      'Sans prix tant qu’il n’est pas lié à Cardmarket. Si le même produit (type, nom, set, numéro) existe déjà, il est renvoyé.',
  })
  @ApiResponse({ status: 201, type: ProductDto })
  @ApiResponse({ status: 403, description: 'Réservé à l’équipe.' })
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDto> {
    return this.productService.create(authorization, dto);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Un produit du catalogue.' })
  @ApiResponse({ status: 200, type: ProductDto })
  @ApiResponse({ status: 404, description: 'Produit introuvable.' })
  get(
    @Headers('authorization') authorization: string | undefined,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductDto> {
    return this.productService.get(authorization, productId);
  }

  @Get(':productId/price')
  @ApiOperation({ summary: 'Dernier prix Cardmarket connu du produit.' })
  @ApiResponse({ status: 200, type: PriceDto })
  @ApiResponse({ status: 404, description: 'Produit introuvable.' })
  getPrice(
    @Headers('authorization') authorization: string | undefined,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<PriceDto> {
    return this.productService.getPrice(authorization, productId);
  }

  @Get(':productId/price-history')
  @ApiOperation({
    summary: 'Relevés quotidiens du prix Cardmarket sur un an.',
    description:
      'Cardmarket ne publie que les prix du jour : l’historique commence au premier relevé enregistré.',
  })
  @ApiResponse({ status: 200, type: [PricePointDto] })
  @ApiResponse({ status: 404, description: 'Produit introuvable.' })
  priceHistory(
    @Headers('authorization') authorization: string | undefined,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<PricePointDto[]> {
    return this.productService.priceHistory(authorization, productId);
  }

  @Put(':productId/cardmarket')
  @ApiOperation({
    summary:
      'Lie le produit à un produit Cardmarket, ou retire le lien (équipe LagonaDeck).',
    description:
      'Corrige un lien faux ou absent : le prix vient alors de ce produit Cardmarket, et la synchronisation ne remplace plus le lien.',
  })
  @ApiResponse({ status: 200, type: ProductDto })
  @ApiResponse({ status: 403, description: 'Réservé à l’équipe.' })
  @ApiResponse({
    status: 404,
    description: 'Produit ou produit Cardmarket introuvable.',
  })
  linkCardmarket(
    @Headers('authorization') authorization: string | undefined,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: LinkCardmarketDto,
  ): Promise<ProductDto> {
    return this.productService.linkCardmarket(
      authorization,
      productId,
      dto.cardmarketId,
    );
  }
}
