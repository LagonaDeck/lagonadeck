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
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId, SessionGuard } from '../session/session.guard';
import { GroupService } from './group.service';
import { GroupDto, SetGroupPermissionsDto } from './models/dtos/group.dto';
import { NameDto } from './models/dtos/organization.dto';

@ApiTags('groups')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Session invalide.' })
@ApiResponse({
  status: 404,
  description: 'Organisation, groupe ou membre introuvable.',
})
@UseGuards(SessionGuard)
@Controller('organizations/:organizationId/groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get()
  @ApiOperation({ summary: "Groupes de l'organisation." })
  @ApiResponse({ status: 200, type: [GroupDto] })
  list(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<GroupDto[]> {
    return this.groupService.list(userId, organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Crée un groupe sans permission (GROUP_CREATE).' })
  @ApiResponse({ status: 201, type: GroupDto })
  @ApiResponse({ status: 409, description: 'Nom déjà utilisé.' })
  create(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: NameDto,
  ): Promise<GroupDto> {
    return this.groupService.create(userId, organizationId, dto.name);
  }

  @Patch(':groupId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Renomme un groupe (GROUP_UPDATE).' })
  @ApiResponse({
    status: 403,
    description: 'Permission insuffisante ou groupe Owner.',
  })
  rename(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: NameDto,
  ): Promise<void> {
    return this.groupService.rename(userId, organizationId, groupId, dto.name);
  }

  @Delete(':groupId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprime un groupe (GROUP_DELETE).' })
  @ApiResponse({
    status: 403,
    description: 'Permission insuffisante ou groupe Owner.',
  })
  delete(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<void> {
    return this.groupService.delete(userId, organizationId, groupId);
  }

  @Put(':groupId/permissions')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Remplace les permissions du groupe (GROUP_MANAGE_PERMISSIONS ; seulement des permissions possédées).',
  })
  @ApiResponse({
    status: 403,
    description: 'Permission insuffisante ou groupe Owner.',
  })
  setPermissions(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: SetGroupPermissionsDto,
  ): Promise<void> {
    return this.groupService.setPermissions(
      userId,
      organizationId,
      groupId,
      dto.permissions,
    );
  }

  @Put(':groupId/members/:memberId')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Ajoute un membre au groupe (MEMBER_MANAGE_GROUPS ; groupe Owner exclu).',
  })
  addMember(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.groupService.addMember(
      userId,
      organizationId,
      groupId,
      memberId,
    );
  }

  @Delete(':groupId/members/:memberId')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Retire un membre du groupe (MEMBER_MANAGE_GROUPS ; groupe Owner exclu).',
  })
  @ApiResponse({
    status: 403,
    description: 'Permission insuffisante ou groupe Owner.',
  })
  removeMember(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.groupService.removeMember(
      userId,
      organizationId,
      groupId,
      memberId,
    );
  }
}
