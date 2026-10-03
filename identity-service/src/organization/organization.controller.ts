import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId, SessionGuard } from '../session/session.guard';
import {
  MemberDto,
  MyOrganizationDto,
  NameDto,
  OrganizationDto,
  PermissionsDto,
} from './models/dtos/organization.dto';
import { OrganizationAccessService } from './organization-access.service';
import { OrganizationService } from './organization.service';

@ApiTags('organizations')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Session invalide.' })
@UseGuards(SessionGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly access: OrganizationAccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Organisations dont l'utilisateur est membre." })
  @ApiResponse({ status: 200, type: [MyOrganizationDto] })
  list(@CurrentUserId() userId: string): Promise<MyOrganizationDto[]> {
    return this.organizationService.listForUser(userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Crée une organisation dont l’utilisateur est le propriétaire.',
  })
  @ApiResponse({ status: 201, type: MyOrganizationDto })
  create(
    @CurrentUserId() userId: string,
    @Body() dto: NameDto,
  ): Promise<MyOrganizationDto> {
    return this.organizationService.create(userId, dto.name);
  }

  @Get(':organizationId')
  @ApiOperation({ summary: 'Une organisation dont on est membre.' })
  @ApiResponse({ status: 200, type: OrganizationDto })
  @ApiResponse({ status: 404, description: 'Introuvable ou non membre.' })
  get(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<OrganizationDto> {
    return this.organizationService.get(userId, organizationId);
  }

  @Patch(':organizationId')
  @ApiOperation({ summary: 'Renomme une organisation (ORGANIZATION_MANAGE).' })
  @ApiResponse({ status: 200, type: OrganizationDto })
  @ApiResponse({ status: 403, description: 'Permission insuffisante.' })
  rename(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: NameDto,
  ): Promise<OrganizationDto> {
    return this.organizationService.rename(userId, organizationId, dto.name);
  }

  @Get(':organizationId/me')
  @ApiOperation({ summary: "Permissions effectives de l'utilisateur." })
  @ApiResponse({ status: 200, type: PermissionsDto })
  async myPermissions(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<PermissionsDto> {
    return {
      permissions: await this.access.getPermissions(userId, organizationId),
    };
  }

  @Get(':organizationId/members')
  @ApiOperation({ summary: "Membres de l'organisation." })
  @ApiResponse({ status: 200, type: [MemberDto] })
  listMembers(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<MemberDto[]> {
    return this.organizationService.listMembers(userId, organizationId);
  }

  @Delete(':organizationId/members/:memberId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Retire un membre (MEMBER_REMOVE).' })
  @ApiResponse({
    status: 403,
    description: 'Permission insuffisante ou propriétaire.',
  })
  removeMember(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.organizationService.removeMember(
      userId,
      organizationId,
      memberId,
    );
  }
}
