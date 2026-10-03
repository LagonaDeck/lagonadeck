import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateUserDto } from '../../../user/models/dtos/user.dto';

export class InviteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;
}

export class EmailInviteDto extends PickType(CreateUserDto, [
  'email',
] as const) {}

export class InvitableUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({
    example: 'm•••@example.com',
    description: 'Complet si la recherche portait sur l’email, masqué sinon.',
  })
  email!: string;

  @ApiProperty({ description: 'Une invitation est déjà en attente.' })
  invited!: boolean;
}

// Soit un compte invité (`userId`, `username`), soit une adresse sans compte (`email`).
export class PendingInvitationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  userId?: string;

  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty()
  createdAt!: Date;
}

export class ReceivedInvitationDto {
  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty()
  organizationName!: string;

  @ApiProperty()
  invitedBy!: string;
}
