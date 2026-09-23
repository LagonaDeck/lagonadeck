import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPublicDto } from './dto/user-public.dto';

/**
 * Aucun contrôle d'accès n'est appliqué ici : l'authentification et la
 * vérification que l'appelant est bien propriétaire de la ressource sont
 * prévues au niveau de l'API Gateway (cf. docs/architecture/microservices.md),
 * pas encore implémentée. Ce contrôleur ne doit pas être exposé directement
 * en dehors du réseau interne tant que ce contrôle n'existe pas.
 */
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
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, type: UserPublicDto })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable.' })
  async findOne(@Param('id') id: string): Promise<UserPublicDto> {
    const user = await this.userService.findById(id);
    return UserPublicDto.fromEntity(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour un utilisateur.' })
  @ApiParam({ name: 'id', description: "Identifiant de l'utilisateur" })
  @ApiResponse({ status: 200, type: UserPublicDto })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable.' })
  @ApiResponse({ status: 409, description: 'Email ou pseudo déjà utilisé.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserPublicDto> {
    const user = await this.userService.update(id, dto);
    return UserPublicDto.fromEntity(user);
  }
}
