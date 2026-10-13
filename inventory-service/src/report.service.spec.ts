import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from './generated/prisma/client';
import { ReportService } from './report.service';

const AUTH = 'Bearer token';

const report = (fields: object = {}) => ({
  id: 'report-1',
  productId: null,
  product: null,
  message: 'Le prix est celui de la version reverse.',
  reportedBy: 'user-1',
  resolvedBy: null,
  status: 'OPEN',
  createdAt: new Date(),
  resolvedAt: null,
  ...fields,
});

describe('ReportService', () => {
  let prisma: {
    catalogReport: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let identity: { requireSession: jest.Mock; requireStaff: jest.Mock };
  let products: { getOrThrow: jest.Mock };
  let service: ReportService;

  beforeEach(() => {
    prisma = {
      catalogReport: {
        create: jest.fn().mockResolvedValue(report()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(report({ status: 'RESOLVED' })),
      },
    };
    identity = {
      requireSession: jest
        .fn()
        .mockResolvedValue({ id: 'user-1', staffPermissions: [] }),
      requireStaff: jest.fn().mockResolvedValue({
        id: 'staff-1',
        staffPermissions: ['CATALOG_MANAGE'],
      }),
    };
    products = { getOrThrow: jest.fn() };
    service = new ReportService(
      prisma as never,
      identity as never,
      products as never,
    );
  });

  it('permet à tout utilisateur de signaler un produit, sous son nom', async () => {
    await service.create(AUTH, {
      productId: 'product-1',
      message: 'Mauvais prix',
    });

    expect(products.getOrThrow).toHaveBeenCalledWith('product-1');
    expect(prisma.catalogReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          productId: 'product-1',
          message: 'Mauvais prix',
          reportedBy: 'user-1',
        },
      }),
    );
  });

  it('accepte le signalement d’un produit manquant, sans produit', async () => {
    await service.create(AUTH, { message: 'Produit manquant : Pikachu XY95' });

    expect(products.getOrThrow).not.toHaveBeenCalled();
    expect(prisma.catalogReport.create).toHaveBeenCalled();
  });

  it('refuse le signalement d’un produit inconnu', async () => {
    products.getOrThrow.mockRejectedValue(new NotFoundException());

    await expect(
      service.create(AUTH, { productId: 'unknown', message: 'x' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.catalogReport.create).not.toHaveBeenCalled();
  });

  it('réserve la liste des signalements à l’équipe LagonaDeck', async () => {
    identity.requireStaff.mockRejectedValue(new ForbiddenException());

    await expect(service.list(AUTH, 'OPEN')).rejects.toThrow(
      ForbiddenException,
    );
    expect(identity.requireStaff).toHaveBeenCalledWith(AUTH, 'CATALOG_MANAGE');
    expect(prisma.catalogReport.findMany).not.toHaveBeenCalled();
  });

  it('retient qui a traité le signalement et quand', async () => {
    await service.updateStatus(AUTH, 'report-1', 'RESOLVED');

    expect(prisma.catalogReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: {
          status: 'RESOLVED',
          resolvedBy: 'staff-1',
          resolvedAt: expect.any(Date),
        },
      }),
    );
  });

  it('répond 404 pour un signalement inconnu', async () => {
    prisma.catalogReport.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('P2025', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    await expect(
      service.updateStatus(AUTH, 'unknown', 'RESOLVED'),
    ).rejects.toThrow(NotFoundException);
  });
});
