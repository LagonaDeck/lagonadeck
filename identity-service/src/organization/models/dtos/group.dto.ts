import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { Permission } from '../../../generated/prisma/client';

export class GroupDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isOwner!: boolean;

  @ApiProperty({ enum: Permission, isArray: true })
  permissions!: Permission[];

  @ApiProperty({ type: [String], format: 'uuid' })
  memberIds!: string[];
}

export class SetGroupPermissionsDto {
  @ApiProperty({ enum: Permission, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true })
  permissions!: Permission[];
}
