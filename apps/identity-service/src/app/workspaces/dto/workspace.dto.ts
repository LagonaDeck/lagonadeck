import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceRole } from '../../../generated/prisma/enums';

export class WorkspaceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: WorkspaceRole,
    description: "Rôle de l'utilisateur appelant dans ce workspace.",
  })
  role: WorkspaceRole;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WorkspaceMemberDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: WorkspaceRole })
  role: WorkspaceRole;

  @ApiProperty()
  createdAt: Date;
}

export class WorkspaceInvitationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  workspaceName: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: WorkspaceRole })
  role: WorkspaceRole;

  @ApiProperty()
  expiresAt: Date;
}
