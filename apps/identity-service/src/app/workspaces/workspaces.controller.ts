import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentUserId,
  USER_ID_HEADER,
} from '../auth/current-user-id.decorator';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceNameDto } from './dto/workspace-name.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import {
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
} from './dto/workspace.dto';

@ApiTags('workspaces')
@ApiHeader({
  name: USER_ID_HEADER,
  description: 'Utilisateur appelant (UUID).',
})
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: "Crée un workspace dont l'appelant est OWNER." })
  @ApiResponse({ status: 201, type: WorkspaceDto })
  create(
    @CurrentUserId() userId: string,
    @Body() dto: WorkspaceNameDto,
  ): Promise<WorkspaceDto> {
    return this.workspaces.create(userId, dto.name);
  }

  @Get()
  @ApiOperation({ summary: "Liste les workspaces de l'appelant." })
  @ApiResponse({ status: 200, type: [WorkspaceDto] })
  findMine(@CurrentUserId() userId: string): Promise<WorkspaceDto[]> {
    return this.workspaces.findMine(userId);
  }

  @Get(':workspaceId')
  @ApiOperation({ summary: 'Récupère un workspace (membre).' })
  @ApiResponse({ status: 200, type: WorkspaceDto })
  findOne(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<WorkspaceDto> {
    return this.workspaces.findOne(userId, workspaceId);
  }

  @Patch(':workspaceId')
  @ApiOperation({ summary: 'Renomme un workspace (ADMIN).' })
  @ApiResponse({ status: 200, type: WorkspaceDto })
  rename(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: WorkspaceNameDto,
  ): Promise<WorkspaceDto> {
    return this.workspaces.rename(userId, workspaceId, dto.name);
  }

  @Delete(':workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime un workspace (OWNER).' })
  @ApiResponse({ status: 204 })
  remove(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<void> {
    return this.workspaces.remove(userId, workspaceId);
  }

  @Get(':workspaceId/members')
  @ApiOperation({ summary: 'Liste les membres (membre).' })
  @ApiResponse({ status: 200, type: [WorkspaceMemberDto] })
  listMembers(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<WorkspaceMemberDto[]> {
    return this.workspaces.listMembers(userId, workspaceId);
  }

  @Patch(':workspaceId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Change le rôle d'un membre (OWNER).",
    description:
      "Le rôle OWNER transfère la propriété : l'appelant devient ADMIN.",
  })
  @ApiResponse({ status: 204 })
  updateMemberRole(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<void> {
    return this.workspaces.updateMemberRole(
      userId,
      workspaceId,
      memberId,
      dto.role,
    );
  }

  @Delete(':workspaceId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Retire un membre, ou quitte le workspace.',
    description:
      'Un membre peut se retirer lui-même ou retirer un membre de rôle inférieur. Le OWNER ne peut pas être retiré.',
  })
  @ApiResponse({ status: 204 })
  removeMember(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<void> {
    return this.workspaces.removeMember(userId, workspaceId, memberId);
  }

  @Post(':workspaceId/invitations')
  @ApiOperation({
    summary: 'Invite une adresse e-mail (ADMIN, OWNER pour inviter un ADMIN).',
    description:
      "Ré-inviter la même adresse met à jour le rôle et repousse l'expiration.",
  })
  @ApiResponse({ status: 201, type: WorkspaceInvitationDto })
  invite(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<WorkspaceInvitationDto> {
    return this.workspaces.invite(userId, workspaceId, dto);
  }

  @Get(':workspaceId/invitations')
  @ApiOperation({ summary: 'Liste les invitations du workspace (ADMIN).' })
  @ApiResponse({ status: 200, type: [WorkspaceInvitationDto] })
  listInvitations(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<WorkspaceInvitationDto[]> {
    return this.workspaces.listInvitations(userId, workspaceId);
  }

  @Delete(':workspaceId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Révoque une invitation (ADMIN).' })
  @ApiResponse({ status: 204 })
  revokeInvitation(
    @CurrentUserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    return this.workspaces.revokeInvitation(userId, workspaceId, invitationId);
  }
}
