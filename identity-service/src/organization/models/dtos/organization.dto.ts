import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Permission, Plan } from '../../../generated/prisma/client';

export class NameDto {
  @ApiProperty({ example: 'Boutique de Lausanne', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class OrganizationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Plan })
  plan!: Plan;
}

export class MyOrganizationDto extends OrganizationDto {
  @ApiProperty({
    type: [String],
    description: "Noms de mes groupes dans l'organisation, Owner en premier.",
  })
  groups!: string[];
}

export class MemberGroupDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class MemberDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ description: 'Le propriétaire de l’organisation.' })
  isOwner!: boolean;

  @ApiProperty({ type: [MemberGroupDto], description: 'Owner en premier.' })
  groups!: MemberGroupDto[];
}

export class PermissionsDto {
  @ApiProperty({ enum: Permission, isArray: true })
  permissions!: Permission[];
}
