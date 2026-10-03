import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { verifyPassword } from '../user/utils/password.util';
import { LoginDto, SessionDto } from './models/dtos/session.dto';
import { generateToken, hashToken } from './utils/token.util';

const TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const notFoundAsNull = (error: unknown) => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return null;
  }
  throw error;
};

@Injectable()
export class SessionService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async login(dto: LoginDto): Promise<SessionDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (
      !user ||
      !(await verifyPassword(dto.password, user.passwordHash, user.salt))
    ) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    return this.create(user.id);
  }

  // Supprimer la session rend le refresh token à usage unique : rejoué, il échoue.
  async refresh(refreshToken: string): Promise<SessionDto> {
    const session = await this.prisma.session
      .delete({ where: { refreshTokenHash: hashToken(refreshToken) } })
      .catch(notFoundAsNull);
    if (!session || session.refreshExpiresAt <= new Date()) {
      throw new UnauthorizedException('Session invalide');
    }
    return this.create(session.userId);
  }

  async findUser(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session invalide');
    }
    return session.user;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { refreshTokenHash: hashToken(refreshToken) },
    });
  }

  private async create(userId: string): Promise<SessionDto> {
    const token = generateToken();
    const refreshToken = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.session.create({
      data: {
        id: hashToken(token),
        refreshTokenHash: hashToken(refreshToken),
        userId,
        expiresAt,
        refreshExpiresAt,
      },
    });
    return { token, refreshToken, expiresAt, refreshExpiresAt };
  }
}
