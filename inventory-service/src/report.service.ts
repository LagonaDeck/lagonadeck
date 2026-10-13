import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  type CatalogReport,
} from './generated/prisma/client';
import { ReportStatus } from './generated/prisma/enums';
import { CATALOG_MANAGE, IdentityService } from './identity.service';
import {
  ProductService,
  ProductWithCardmarket,
  toProductDto,
} from './product.service';
import { CreateReportDto, ReportDto } from './report.dto';

const WITH_PRODUCT = {
  product: { include: { cardmarketProduct: true } },
} as const;

const toDto = (
  report: CatalogReport & { product: ProductWithCardmarket | null },
): ReportDto => ({
  id: report.id,
  product: report.product && toProductDto(report.product),
  message: report.message,
  status: report.status,
  createdAt: report.createdAt,
  resolvedAt: report.resolvedAt,
});

// Le catalogue est partagé : un utilisateur ne le corrige pas lui-même, il
// signale le problème à l'équipe LagonaDeck, qui le traite.
@Injectable()
export class ReportService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly identity: IdentityService,
    private readonly productService: ProductService,
  ) {}

  async create(
    authorization: string | undefined,
    dto: CreateReportDto,
  ): Promise<ReportDto> {
    const user = await this.identity.requireSession(authorization);
    if (dto.productId) await this.productService.getOrThrow(dto.productId);
    const report = await this.prisma.catalogReport.create({
      data: {
        productId: dto.productId,
        message: dto.message,
        reportedBy: user.id,
      },
      include: WITH_PRODUCT,
    });
    return toDto(report);
  }

  async list(
    authorization: string | undefined,
    status: ReportStatus,
  ): Promise<ReportDto[]> {
    await this.identity.requireStaff(authorization, CATALOG_MANAGE);
    const reports = await this.prisma.catalogReport.findMany({
      where: { status },
      include: WITH_PRODUCT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return reports.map(toDto);
  }

  async updateStatus(
    authorization: string | undefined,
    id: string,
    status: ReportStatus,
  ): Promise<ReportDto> {
    const user = await this.identity.requireStaff(
      authorization,
      CATALOG_MANAGE,
    );
    const resolved = status === ReportStatus.RESOLVED;
    try {
      const report = await this.prisma.catalogReport.update({
        where: { id },
        data: {
          status,
          resolvedBy: resolved ? user.id : null,
          resolvedAt: resolved ? new Date() : null,
        },
        include: WITH_PRODUCT,
      });
      return toDto(report);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Signalement introuvable');
      }
      throw error;
    }
  }
}
