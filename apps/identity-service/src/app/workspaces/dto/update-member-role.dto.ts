import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '../../../generated/prisma/enums';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: WorkspaceRole,
    description:
      "OWNER transfère la propriété : l'actuel propriétaire devient ADMIN.",
  })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}
