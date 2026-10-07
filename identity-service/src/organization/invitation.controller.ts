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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId, SessionGuard } from '../session/session.guard';
import { InvitationService } from './invitation.service';
import {
  EmailInviteDto,
  InvitableUserDto,
  InviteDto,
  PendingInvitationDto,
  ReceivedInvitationDto,
} from './models/dtos/invitation.dto';
import { MyOrganizationDto } from './models/dtos/organization.dto';

// Déclaré avant OrganizationController dans main.ts : sinon `GET
// organizations/invitations` serait pris pour `GET organizations/:organizationId`.
@ApiTags('invitations')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Session invalide.' })
@UseGuards(SessionGuard)
@Controller('organizations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get('invitations')
  @ApiOperation({ summary: 'Invitations reçues par l’utilisateur.' })
  @ApiResponse({ status: 200, type: [ReceivedInvitationDto] })
  listReceived(
    @CurrentUserId() userId: string,
  ): Promise<ReceivedInvitationDto[]> {
    return this.invitationService.listReceived(userId);
  }

  @Post('invitations/:organizationId/accept')
  @ApiOperation({
    summary: 'Accepte une invitation : devient membre, sans groupe.',
  })
  @ApiResponse({ status: 201, type: MyOrganizationDto })
  @ApiResponse({ status: 404, description: 'Invitation introuvable.' })
  accept(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<MyOrganizationDto> {
    return this.invitationService.accept(userId, organizationId);
  }

  @Delete('invitations/:organizationId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Refuse une invitation.' })
  decline(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<void> {
    return this.invitationService.decline(userId, organizationId);
  }

  @Get(':organizationId/invitable-users')
  @ApiOperation({
    summary:
      'Cherche un compte à inviter : email exact ou début du nom (3 caractères minimum) (MEMBER_INVITE).',
  })
  @ApiQuery({ name: 'q' })
  @ApiResponse({ status: 200, type: [InvitableUserDto] })
  searchInvitable(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('q') query = '',
  ): Promise<InvitableUserDto[]> {
    return this.invitationService.searchInvitable(
      userId,
      organizationId,
      query,
    );
  }

  @Get(':organizationId/invitations')
  @ApiOperation({ summary: 'Invitations en attente de l’organisation.' })
  @ApiResponse({ status: 200, type: [PendingInvitationDto] })
  listPending(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<PendingInvitationDto[]> {
    return this.invitationService.listPending(userId, organizationId);
  }

  @Post(':organizationId/invitations')
  @HttpCode(204)
  @ApiOperation({ summary: 'Invite un utilisateur (MEMBER_INVITE).' })
  @ApiResponse({ status: 409, description: 'Déjà membre ou déjà invité.' })
  invite(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: InviteDto,
  ): Promise<void> {
    return this.invitationService.invite(userId, organizationId, dto.userId);
  }

  @Post(':organizationId/email-invitations')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Invite une adresse sans compte : l’invitation l’attend à son inscription (MEMBER_INVITE).',
  })
  @ApiResponse({ status: 409, description: 'Déjà membre ou déjà invité.' })
  inviteEmail(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: EmailInviteDto,
  ): Promise<void> {
    return this.invitationService.inviteEmail(
      userId,
      organizationId,
      dto.email,
    );
  }

  @Delete(':organizationId/email-invitations/:email')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Révoque l’invitation d’une adresse (MEMBER_INVITE).',
  })
  revokeEmail(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('email') email: string,
  ): Promise<void> {
    return this.invitationService.revokeEmail(userId, organizationId, email);
  }

  @Delete(':organizationId/invitations/:inviteeId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Révoque une invitation (MEMBER_INVITE).' })
  revoke(
    @CurrentUserId() userId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('inviteeId', ParseUUIDPipe) inviteeId: string,
  ): Promise<void> {
    return this.invitationService.revoke(userId, organizationId, inviteeId);
  }
}
