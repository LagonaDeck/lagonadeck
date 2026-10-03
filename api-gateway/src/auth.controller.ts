import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  Put,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { callIdentity, readCookie } from './identity';

interface Session {
  token: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
}

const cookie = (name: string, value: string, path: string, expires: Date) =>
  `${name}=${value}; Path=${path}; Expires=${expires.toUTCString()}; HttpOnly; Secure; SameSite=Strict`;

// Le refresh token n'est envoyé qu'aux routes d'auth, pas au reste de l'API.
function setSessionCookies(res: ServerResponse, session: Session) {
  res.setHeader('Set-Cookie', [
    cookie('session', session.token, '/api', new Date(session.expiresAt)),
    cookie(
      'refresh',
      session.refreshToken,
      '/api/auth',
      new Date(session.refreshExpiresAt),
    ),
  ]);
}

function clearSessionCookies(res: ServerResponse) {
  res.setHeader('Set-Cookie', [
    cookie('session', '', '/api', new Date(0)),
    cookie('refresh', '', '/api/auth', new Date(0)),
  ]);
}

@Controller('auth')
export class AuthController {
  @Post('signup')
  async signup(
    @Body() body: { email?: unknown; password?: unknown },
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<unknown> {
    const user = await callIdentity('/api/users', { body });
    const session = await callIdentity<Session>('/api/sessions', {
      body: { email: body.email, password: body.password },
    });
    setSessionCookies(res, session);
    return user;
  }

  @Post('login')
  @HttpCode(204)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<void> {
    setSessionCookies(res, await callIdentity('/api/sessions', { body }));
  }

  @Post('refresh')
  @HttpCode(204)
  async refresh(
    @Headers('cookie') cookies: string | undefined,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<void> {
    const refreshToken = readCookie(cookies, 'refresh');
    if (!refreshToken) throw new UnauthorizedException('Session invalide');
    setSessionCookies(
      res,
      await callIdentity('/api/sessions/refresh', { body: { refreshToken } }),
    );
  }

  @Get('me')
  me(@Headers('cookie') cookies: string | undefined): Promise<unknown> {
    const token = readCookie(cookies, 'session');
    if (!token) throw new UnauthorizedException('Session invalide');
    return callIdentity('/api/sessions/current', { token });
  }

  @Patch('me')
  updateMe(
    @Headers('cookie') cookies: string | undefined,
    @Body() body: unknown,
  ): Promise<unknown> {
    const token = readCookie(cookies, 'session');
    if (!token) throw new UnauthorizedException('Session invalide');
    return callIdentity('/api/users/me', { method: 'PATCH', body, token });
  }

  @Put('me/password')
  @HttpCode(204)
  async changePassword(
    @Headers('cookie') cookies: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    const token = readCookie(cookies, 'session');
    if (!token) throw new UnauthorizedException('Session invalide');
    await callIdentity('/api/users/me/password', {
      method: 'PUT',
      body,
      token,
    });
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Headers('cookie') cookies: string | undefined,
    @Res({ passthrough: true }) res: ServerResponse,
  ): Promise<void> {
    const refreshToken = readCookie(cookies, 'refresh');
    if (refreshToken) {
      await callIdentity('/api/sessions/logout', { body: { refreshToken } });
    }
    clearSessionCookies(res);
  }
}
