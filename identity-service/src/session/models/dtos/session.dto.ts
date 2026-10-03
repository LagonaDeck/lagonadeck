import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { CreateUserDto } from '../../../user/models/dtos/user.dto';

export class LoginDto extends PickType(CreateUserDto, ['email'] as const) {
  // Pas les règles de robustesse du signup : elles ne concernent que la création.
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class SessionDto {
  @ApiProperty()
  token!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  refreshExpiresAt!: Date;
}
