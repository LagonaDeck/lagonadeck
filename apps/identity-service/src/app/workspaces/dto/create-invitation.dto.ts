import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';
import { WorkspaceRole } from '../../../generated/prisma/enums';
import { normalizeEmail } from '../../common/normalize';

/** Rôles attribuables par invitation : la propriété se transfère, elle ne s'invite pas. */
export const INVITABLE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.MEMBER];

export class CreateInvitationDto {
  @ApiProperty({ example: 'associe@example.com' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: INVITABLE_ROLES, default: WorkspaceRole.MEMBER })
  @IsIn(INVITABLE_ROLES)
  role: WorkspaceRole = WorkspaceRole.MEMBER;
}
