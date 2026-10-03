import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId, SessionGuard } from '../session/session.guard';
import { bearerToken, hashToken } from '../session/utils/token.util';
import {
  ChangePasswordDto,
  CreateUserDto,
  CurrentUserDto,
  UpdateProfileDto,
  UserPublicDto,
} from './models/dtos/user.dto';
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

  @Patch('me')
  @UseGuards(SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Modifie le profil de l'utilisateur connecté." })
  @ApiResponse({ status: 200, type: CurrentUserDto })
  @ApiResponse({ status: 401, description: 'Session invalide.' })
  @ApiResponse({
    status: 409,
    description: 'Email ou nom d’utilisateur déjà utilisé.',
  })
  async updateMe(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<CurrentUserDto> {
    const user = await this.userService.updateProfile(userId, dto);
    return CurrentUserDto.fromEntity(user);
  }

  @Put('me/password')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Change le mot de passe de l'utilisateur connecté et ferme ses autres sessions.",
  })
  @ApiResponse({
    status: 400,
    description:
      'Mot de passe actuel incorrect ou nouveau mot de passe invalide.',
  })
  @ApiResponse({ status: 401, description: 'Session invalide.' })
  changePassword(
    @CurrentUserId() userId: string,
    @Headers('authorization') authorization: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.userService.changePassword(
      userId,
      hashToken(bearerToken(authorization)),
      dto,
    );
  }
}
