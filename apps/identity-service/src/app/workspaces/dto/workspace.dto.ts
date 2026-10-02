import { ApiProperty } from '@nestjs/swagger';
import { Prisma, Workspace } from '../../../generated/prisma/client';
import { WorkspaceRole } from '../../../generated/prisma/enums';

type MemberWithUser = Prisma.WorkspaceMemberGetPayload<{
  include: { user: true };
}>;
type InvitationWithWorkspace = Prisma.WorkspaceInvitationGetPayload<{
  include: { workspace: true };
}>;

export class WorkspaceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    enum: WorkspaceRole,
    description: "Rôle de l'utilisateur appelant dans ce workspace.",
  })
  role!: WorkspaceRole;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(workspace: Workspace, role: WorkspaceRole): WorkspaceDto {
    const dto = new WorkspaceDto();
    dto.id = workspace.id;
    dto.name = workspace.name;
    dto.role = role;
    dto.createdAt = workspace.createdAt;
    dto.updatedAt = workspace.updatedAt;
    return dto;
  }
}

export class WorkspaceMemberDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: WorkspaceRole })
  role!: WorkspaceRole;

  @ApiProperty()
  createdAt!: Date;

  static fromEntity(member: MemberWithUser): WorkspaceMemberDto {
    const dto = new WorkspaceMemberDto();
    dto.userId = member.userId;
    dto.email = member.user.email;
    dto.role = member.role;
    dto.createdAt = member.createdAt;
    return dto;
  }
}

export class WorkspaceInvitationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  workspaceName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: WorkspaceRole })
  role!: WorkspaceRole;

  @ApiProperty()
  expiresAt!: Date;

  static fromEntity(
    invitation: InvitationWithWorkspace,
  ): WorkspaceInvitationDto {
    const dto = new WorkspaceInvitationDto();
    dto.id = invitation.id;
    dto.workspaceId = invitation.workspaceId;
    dto.workspaceName = invitation.workspace.name;
    dto.email = invitation.email;
    dto.role = invitation.role;
    dto.expiresAt = invitation.expiresAt;
    return dto;
  }
}
