import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { verifyPassword } from '../user/utils/password.util';
import { LoginThrottleService } from './login-throttle.service';
import { LoginDto, SessionDto } from './models/dtos/session.dto';
import { generateToken, hashToken } from './utils/token.util';

const TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

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
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly throttle: LoginThrottleService,
  ) {}

  onModuleInit() {
    setInterval(
      () =>
        void this.purgeExpired().catch((error) =>
          this.logger.error(`Échec de la purge des sessions : ${error}`),
        ),
      PURGE_INTERVAL_MS,
    ).unref();
  }

  async login(dto: LoginDto): Promise<SessionDto> {
    this.throttle.assertAllowed(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (
      !user ||
      !(await verifyPassword(dto.password, user.passwordHash, user.salt))
    ) {
      this.throttle.recordFailure(dto.email);
      throw new UnauthorizedException('Identifiants invalides');
    }
    this.throttle.reset(dto.email);
    return this.create(user.id);
  }

  // Une session dont le refresh token a expiré ne peut plus servir.
  async purgeExpired(): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { refreshExpiresAt: { lt: new Date() } },
    });
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
