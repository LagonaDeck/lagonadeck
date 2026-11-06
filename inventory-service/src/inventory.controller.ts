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
import { CurrentUser } from './current-user';
import {
  AddInventoryItemDto,
  AddInventoryItemsDto,
  InventoryItemDto,
  InventorySummaryDto,
  ListInventoryDto,
  RemoveInventoryItemsDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiSecurity({ internal: [], user: [] })
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
    @CurrentUser() user: CurrentUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListInventoryDto,
  ): Promise<InventoryItemDto[]> {
    return this.inventoryService.list(user.id, organizationId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Total du stock : exemplaires et valeur au prix Cardmarket.',
  })
  @ApiResponse({ status: 200, type: InventorySummaryDto })
  summary(
    @CurrentUser() user: CurrentUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<InventorySummaryDto> {
    return this.inventoryService.summary(user.id, organizationId);
  }

  @Post()
  @ApiOperation({
    summary: 'Ajoute un exemplaire au stock (INVENTORY_MANAGE).',
  })
  @ApiResponse({ status: 201, type: InventoryItemDto })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  add(
    @CurrentUser() user: CurrentUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: AddInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.add(user.id, organizationId, dto);
  }

  @Post('batch')
  @ApiOperation({
    summary:
      'Ajoute un lot d’exemplaires au stock, tout ou rien (INVENTORY_MANAGE).',
  })
  @ApiResponse({ status: 201, type: [InventoryItemDto] })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  @ApiResponse({ status: 409, description: 'Un id existe déjà.' })
  addMany(
    @CurrentUser() user: CurrentUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: AddInventoryItemsDto,
  ): Promise<InventoryItemDto[]> {
    return this.inventoryService.addMany(user.id, organizationId, dto);
  }

  @Delete('batch')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Retire un lot d’exemplaires du stock ; ceux déjà retirés sont ignorés (INVENTORY_MANAGE).',
  })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  removeMany(
    @CurrentUser() user: CurrentUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: RemoveInventoryItemsDto,
  ): Promise<void> {
    return this.inventoryService.removeMany(user.id, organizationId, dto);
  }

  @Get(':itemId')
  @ApiOperation({ summary: 'Un exemplaire du stock, avec son produit.' })
  @ApiResponse({ status: 200, type: InventoryItemDto })
  get(
    @CurrentUser() user: CurrentUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.get(user.id, organizationId, itemId);
  }

  @Delete(':itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprime un exemplaire (INVENTORY_MANAGE).' })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  remove(
    @CurrentUser() user: CurrentUser,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    return this.inventoryService.remove(user.id, organizationId, itemId);
  }
}
