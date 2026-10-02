import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserPublicDto } from './user.dto';

// Aucun contrôle d'accès ici : l'authentification est prévue dans l'api-gateway,
// pas encore implémentée. Ne pas exposer ce service hors du réseau interne d'ici là.
@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Crée un utilisateur.' })
  @ApiResponse({ status: 201, type: UserPublicDto })
  @ApiResponse({ status: 409, description: 'Email ou pseudo déjà utilisé.' })
  async create(@Body() dto: CreateUserDto): Promise<UserPublicDto> {
    const user = await this.userService.create(dto);
    return UserPublicDto.fromEntity(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupère un utilisateur par id.' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: "Identifiant de l'utilisateur",
  })
  @ApiResponse({ status: 200, type: UserPublicDto })
  @ApiResponse({ status: 400, description: 'Identifiant invalide.' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserPublicDto> {
    const user = await this.userService.findById(id);
    return UserPublicDto.fromEntity(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour un utilisateur.' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: "Identifiant de l'utilisateur",
  })
  @ApiResponse({ status: 200, type: UserPublicDto })
  @ApiResponse({ status: 400, description: 'Identifiant ou corps invalide.' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable.' })
  @ApiResponse({ status: 409, description: 'Email ou pseudo déjà utilisé.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserPublicDto> {
    const user = await this.userService.update(id, dto);
    return UserPublicDto.fromEntity(user);
  }
}
