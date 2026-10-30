import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreatePurchaseDto,
  ListPurchasesDto,
  PurchaseDetailDto,
  PurchaseDto,
  PurchasedItemDto,
  PurchasesSummaryDto,
} from './purchase.dto';
import { PurchaseService } from './purchase.service';

@ApiTags('purchases')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Session invalide.' })
@ApiResponse({ status: 404, description: 'Introuvable ou non membre.' })
@Controller('organizations/:organizationId/purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  @ApiOperation({ summary: "Achats de l'organisation, du plus récent." })
  @ApiResponse({ status: 200, type: [PurchaseDto] })
  list(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListPurchasesDto,
  ): Promise<PurchaseDto[]> {
    return this.purchaseService.list(authorization, organizationId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Total des achats : nombre, exemplaires, dépense.' })
  @ApiResponse({ status: 200, type: PurchasesSummaryDto })
  summary(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<PurchasesSummaryDto> {
    return this.purchaseService.summary(authorization, organizationId);
  }

  @Get('items/:inventoryItemId')
  @ApiOperation({ summary: "Achat et coût d'un exemplaire du stock." })
  @ApiResponse({ status: 200, type: PurchasedItemDto })
  getItem(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('inventoryItemId', ParseUUIDPipe) inventoryItemId: string,
  ): Promise<PurchasedItemDto> {
    return this.purchaseService.getItem(
      authorization,
      organizationId,
      inventoryItemId,
    );
  }

  @Post()
  @ApiOperation({
    summary:
      'Enregistre un achat, ajoute ses exemplaires au stock et répartit son coût (PURCHASE_MANAGE et INVENTORY_MANAGE).',
  })
  @ApiResponse({ status: 201, type: PurchaseDetailDto })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  create(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreatePurchaseDto,
  ): Promise<PurchaseDetailDto> {
    return this.purchaseService.create(authorization, organizationId, dto);
  }

  @Get(':purchaseId')
  @ApiOperation({ summary: 'Un achat, avec ses exemplaires et leur coût.' })
  @ApiResponse({ status: 200, type: PurchaseDetailDto })
  get(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
  ): Promise<PurchaseDetailDto> {
    return this.purchaseService.get(authorization, organizationId, purchaseId);
  }

  @Delete(':purchaseId')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Supprime un achat et retire ses exemplaires du stock (PURCHASE_MANAGE et INVENTORY_MANAGE).',
  })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
  ): Promise<void> {
    return this.purchaseService.remove(
      authorization,
      organizationId,
      purchaseId,
    );
  }
}
