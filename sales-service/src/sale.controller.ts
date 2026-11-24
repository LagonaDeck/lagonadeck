import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from './current-user';
import {
  CreateSaleDto,
  ListSalesDto,
  SaleDetailDto,
  SaleDto,
  SalesSummaryDto,
  SalesSummaryQueryDto,
} from './sale.dto';
import { SaleService } from './sale.service';

@ApiTags('sales')
@ApiSecurity({ internal: [], user: [] })
@ApiResponse({ status: 401, description: 'Session invalide.' })
@ApiResponse({ status: 404, description: 'Introuvable ou non membre.' })
@Controller('organizations/:organizationId/sales')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Get()
  @ApiOperation({ summary: "Ventes de l'organisation, de la plus récente." })
  @ApiResponse({ status: 200, type: [SaleDto] })
  list(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListSalesDto,
  ): Promise<SaleDto[]> {
    return this.saleService.list(userId, organizationId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Total des ventes sur une période : nombre, exemplaires, marge.',
  })
  @ApiResponse({ status: 200, type: SalesSummaryDto })
  summary(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: SalesSummaryQueryDto,
  ): Promise<SalesSummaryDto> {
    return this.saleService.summary(userId, organizationId, query);
  }

  @Post()
  @ApiOperation({
    summary:
      'Enregistre une vente, sort ses exemplaires du stock et répartit son prix (SALE_MANAGE et INVENTORY_MANAGE).',
  })
  @ApiResponse({ status: 201, type: SaleDetailDto })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  @ApiResponse({ status: 409, description: 'Exemplaire déjà vendu.' })
  create(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateSaleDto,
  ): Promise<SaleDetailDto> {
    return this.saleService.create(userId, organizationId, dto);
  }

  @Get(':saleId')
  @ApiOperation({ summary: 'Une vente, avec ses exemplaires et leur marge.' })
  @ApiResponse({ status: 200, type: SaleDetailDto })
  get(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
  ): Promise<SaleDetailDto> {
    return this.saleService.get(userId, organizationId, saleId);
  }

  @Delete(':saleId')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Supprime une vente et remet ses exemplaires au stock (SALE_MANAGE et INVENTORY_MANAGE).',
  })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  remove(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('saleId', ParseUUIDPipe) saleId: string,
  ): Promise<void> {
    return this.saleService.remove(userId, organizationId, saleId);
  }
}
