import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentSessionDto,
  LoginDto,
  RefreshSessionDto,
  SessionDto,
} from './models/dtos/session.dto';
import { SessionService } from './session.service';
import { bearerToken } from './utils/token.util';

@ApiTags('sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @ApiOperation({ summary: 'Ouvre une session (login).' })
  @ApiResponse({ status: 201, type: SessionDto })
  @ApiResponse({ status: 401, description: 'Identifiants invalides.' })
  login(@Body() dto: LoginDto): Promise<SessionDto> {
    return this.sessionService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Échange un refresh token contre une nouvelle session.',
  })
  @ApiResponse({ status: 200, type: SessionDto })
  @ApiResponse({
    status: 401,
    description: 'Refresh token invalide ou expiré.',
  })
  refresh(@Body() dto: RefreshSessionDto): Promise<SessionDto> {
    return this.sessionService.refresh(dto.refreshToken);
  }

  // Seule route qui lit le token : la gateway l'appelle pour authentifier
  // chaque requête, puis transmet l'utilisateur aux services.
  @Get('current')
  @ApiSecurity({ internal: [], bearer: [] })
  @ApiOperation({ summary: 'Session du token, avec son utilisateur.' })
  @ApiResponse({ status: 200, type: CurrentSessionDto })
  @ApiResponse({ status: 401, description: 'Session invalide ou expirée.' })
  async current(
    @Headers('authorization') authorization?: string,
  ): Promise<CurrentSessionDto> {
    const session = await this.sessionService.findSession(
      bearerToken(authorization),
    );
    return CurrentSessionDto.fromEntity(session);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Ferme la session du refresh token (logout).' })
  logout(@Body() dto: RefreshSessionDto): Promise<void> {
    return this.sessionService.logout(dto.refreshToken);
  }
}
