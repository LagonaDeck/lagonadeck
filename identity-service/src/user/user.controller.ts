import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto, UserPublicDto } from './models/dtos/user.dto';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Crée un utilisateur.' })
  @ApiResponse({ status: 201, type: UserPublicDto })
  @ApiResponse({
    status: 409,
    description: 'Email ou nom d’utilisateur déjà utilisé.',
  })
  async createUser(@Body() dto: CreateUserDto): Promise<UserPublicDto> {
    const user = await this.userService.create(dto);
    return UserPublicDto.fromEntity(user);
  }
}
