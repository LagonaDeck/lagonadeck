import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentUserId,
  USER_ID_HEADER,
} from '../auth/current-user-id.decorator';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceDto, WorkspaceInvitationDto } from './dto/workspace.dto';

/** Côté invité : invitations adressées à l'e-mail de l'utilisateur appelant. */
@ApiTags('invitations')
@ApiHeader({
  name: USER_ID_HEADER,
  description: 'Utilisateur appelant (UUID).',
})
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @ApiOperation({ summary: "Liste les invitations en attente de l'appelant." })
  @ApiResponse({ status: 200, type: [WorkspaceInvitationDto] })
  findMine(@CurrentUserId() userId: string): Promise<WorkspaceInvitationDto[]> {
    return this.workspaces.findMyInvitations(userId);
  }

  @Post(':invitationId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accepte une invitation et rejoint le workspace.' })
  @ApiResponse({ status: 200, type: WorkspaceDto })
  accept(
    @CurrentUserId() userId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<WorkspaceDto> {
    return this.workspaces.acceptInvitation(userId, invitationId);
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Refuse une invitation.' })
  @ApiResponse({ status: 204 })
  decline(
    @CurrentUserId() userId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    return this.workspaces.declineInvitation(userId, invitationId);
  }
}
