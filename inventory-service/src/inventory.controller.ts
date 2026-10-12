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
  AddInventoryItemDto,
  InventoryItemDto,
  InventorySummaryDto,
  ListInventoryDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Session invalide.' })
@ApiResponse({ status: 404, description: 'Introuvable ou non membre.' })
@Controller('organizations/:organizationId/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({
    summary: "Stock de l'organisation, avec le prix de chaque produit.",
  })
  @ApiResponse({ status: 200, type: [InventoryItemDto] })
  list(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListInventoryDto,
  ): Promise<InventoryItemDto[]> {
    return this.inventoryService.list(authorization, organizationId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Total du stock : exemplaires et valeur au prix Cardmarket.',
  })
  @ApiResponse({ status: 200, type: InventorySummaryDto })
  summary(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<InventorySummaryDto> {
    return this.inventoryService.summary(authorization, organizationId);
  }

  @Post()
  @ApiOperation({
    summary: 'Ajoute un exemplaire au stock (INVENTORY_MANAGE).',
  })
  @ApiResponse({ status: 201, type: InventoryItemDto })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  add(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: AddInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.add(authorization, organizationId, dto);
  }

  @Get(':itemId')
  @ApiOperation({ summary: 'Un exemplaire du stock, avec son produit.' })
  @ApiResponse({ status: 200, type: InventoryItemDto })
  get(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.get(authorization, organizationId, itemId);
  }

  @Delete(':itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprime un exemplaire (INVENTORY_MANAGE).' })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.inventoryService.remove(authorization, organizationId, itemId);
  }
}
