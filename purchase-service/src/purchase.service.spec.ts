import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from './generated/prisma/client';
import { PurchaseService } from './purchase.service';

const AUTH = 'Bearer token';
const ORG = 'org-a';

const inventoryItem = (id: string, price: string | null) => ({
  id,
  condition: 'NEAR_MINT',
  language: 'FRENCH',
  gradingCompany: null,
  grade: null,
  reverse: false,
  price,
  product: {
    id: `product-${id}`,
    name: 'Dracaufeu-ex',
    productType: 'SINGLE',
    setCode: 'MEW',
    setName: '151',
    cardNumber: '006',
    imageUrl: null,
  },
});

const line = (productId: string, quantity = 1) => ({
  productId,
  condition: 'NEAR_MINT',
  language: 'FRENCH',
  quantity,
});

const lot = (lines: ReturnType<typeof line>[], price = 60, fees = 0) => ({
  supplier: 'Vinted',
  purchasedAt: '2026-10-13',
  price,
  fees,
  lines,
});

const savedPurchase = (lines: object[] = []) => ({
  id: 'purchase-1',
  organizationId: ORG,
  supplier: 'Vinted',
  purchasedAt: new Date('2026-10-13'),
  price: new Prisma.Decimal(60),
  fees: new Prisma.Decimal(0),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lines,
});

describe('PurchaseService', () => {
  let prisma: {
    purchase: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
    };
    purchaseLine: { groupBy: jest.Mock; findFirst: jest.Mock };
  };
  let identity: { getPermissions: jest.Mock; requirePermission: jest.Mock };
  let inventory: { addItem: jest.Mock; removeItem: jest.Mock };
  let service: PurchaseService;

  beforeEach(() => {
    prisma = {
      purchase: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        // Renvoie l'achat tel qu'il serait enregistré, lignes comprises.
        create: jest.fn(({ data }) =>
          Promise.resolve(
            savedPurchase(
              data.lines.create.map(
                (created: { marketPrice: string | null }, index: number) => ({
                  ...created,
                  id: `line-${index}`,
                  purchaseId: 'purchase-1',
                  marketPrice:
                    created.marketPrice &&
                    new Prisma.Decimal(created.marketPrice),
                  grade: null,
                }),
              ),
            ),
          ),
        ),
        deleteMany: jest.fn(),
      },
      purchaseLine: { groupBy: jest.fn(), findFirst: jest.fn() },
    };
    identity = { getPermissions: jest.fn(), requirePermission: jest.fn() };
    inventory = { addItem: jest.fn(), removeItem: jest.fn() };
    service = new PurchaseService(
      prisma as never,
      identity,
      inventory as never,
    );
  });

  it('ajoute chaque exemplaire du lot au stock et répartit le prix au Price Trend', async () => {
    inventory.addItem
      .mockResolvedValueOnce(inventoryItem('item-1', '40.00'))
      .mockResolvedValueOnce(inventoryItem('item-2', '20.00'));

    const purchase = await service.create(
      AUTH,
      ORG,
      lot([line('p1'), line('p2')]),
    );

    expect(identity.requirePermission).toHaveBeenCalledWith(
      AUTH,
      ORG,
      'PURCHASE_MANAGE',
    );
    expect(inventory.addItem).toHaveBeenCalledWith(AUTH, ORG, {
      productId: 'p1',
      condition: 'NEAR_MINT',
      language: 'FRENCH',
    });
    expect(purchase.lines.map(({ cost }) => cost)).toEqual(['40.00', '20.00']);
    expect(purchase).toEqual(
      expect.objectContaining({
        totalCost: '60.00',
        marketValue: '60.00',
        itemCount: 2,
      }),
    );
  });

  it('crée un exemplaire par unité et inclut les frais dans le coût', async () => {
    inventory.addItem.mockResolvedValue(inventoryItem('item', null));

    const purchase = await service.create(
      AUTH,
      ORG,
      lot([line('booster', 3)], 15, 3),
    );

    expect(inventory.addItem).toHaveBeenCalledTimes(3);
    expect(purchase.lines.map(({ cost }) => cost)).toEqual([
      '6.00',
      '6.00',
      '6.00',
    ]);
  });

  it('garde le coût saisi pour une ligne et répartit le reste', async () => {
    inventory.addItem
      .mockResolvedValueOnce(inventoryItem('item-1', '10.00'))
      .mockResolvedValueOnce(inventoryItem('item-2', '30.00'))
      .mockResolvedValueOnce(inventoryItem('item-3', '10.00'));

    const purchase = await service.create(
      AUTH,
      ORG,
      lot([{ ...line('p1'), unitCost: 50 }, line('p2'), line('p3')], 90),
    );

    expect(purchase.lines.map(({ cost }) => cost)).toEqual([
      '50.00',
      '30.00',
      '10.00',
    ]);
  });

  it('refuse des coûts saisis supérieurs au lot sans toucher au stock', async () => {
    await expect(
      service.create(AUTH, ORG, lot([{ ...line('p1'), unitCost: 80 }], 60)),
    ).rejects.toThrow(BadRequestException);
    expect(inventory.addItem).not.toHaveBeenCalled();
  });

  it('refuse un achat de plus de 100 exemplaires', async () => {
    await expect(
      service.create(AUTH, ORG, lot([line('p1', 60), line('p2', 41)])),
    ).rejects.toThrow(BadRequestException);
    expect(inventory.addItem).not.toHaveBeenCalled();
  });

  it('retire du stock les exemplaires déjà créés si un ajout échoue', async () => {
    inventory.addItem
      .mockResolvedValueOnce(inventoryItem('item-1', '10.00'))
      .mockRejectedValueOnce(new BadRequestException('Langue invalide'));

    await expect(
      service.create(AUTH, ORG, lot([line('p1'), line('p2')])),
    ).rejects.toThrow(BadRequestException);
    expect(inventory.removeItem).toHaveBeenCalledWith(AUTH, ORG, 'item-1');
    expect(prisma.purchase.create).not.toHaveBeenCalled();
  });

  it('retire du stock les exemplaires si l’achat ne peut être enregistré', async () => {
    inventory.addItem.mockResolvedValue(inventoryItem('item-1', '10.00'));
    prisma.purchase.create.mockRejectedValue(new Error('base indisponible'));

    await expect(service.create(AUTH, ORG, lot([line('p1')]))).rejects.toThrow(
      'base indisponible',
    );
    expect(inventory.removeItem).toHaveBeenCalledWith(AUTH, ORG, 'item-1');
  });

  it('refuse l’achat sans la permission, avant de toucher au stock', async () => {
    identity.requirePermission.mockRejectedValue(new ForbiddenException());

    await expect(service.create(AUTH, ORG, lot([line('p1')]))).rejects.toThrow(
      ForbiddenException,
    );
    expect(inventory.addItem).not.toHaveBeenCalled();
  });

  it("ne liste que les achats de l'organisation, avec leurs totaux", async () => {
    prisma.purchase.findMany.mockResolvedValue([savedPurchase()]);
    prisma.purchaseLine.groupBy.mockResolvedValue([
      {
        purchaseId: 'purchase-1',
        _count: { _all: 2 },
        _sum: { marketPrice: new Prisma.Decimal('75.5') },
      },
    ]);

    const [purchase] = await service.list(AUTH, ORG, { take: 20, skip: 0 });

    expect(identity.getPermissions).toHaveBeenCalledWith(AUTH, ORG);
    expect(prisma.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } }),
    );
    expect(purchase).toEqual(
      expect.objectContaining({
        itemCount: 2,
        marketValue: '75.50',
        purchasedAt: '2026-10-13',
      }),
    );
  });

  it('supprime un achat en retirant ses exemplaires du stock', async () => {
    prisma.purchase.findFirst.mockResolvedValue(
      savedPurchase([
        { inventoryItemId: 'item-1' },
        { inventoryItemId: 'item-2' },
      ]),
    );

    await service.remove(AUTH, ORG, 'purchase-1');

    expect(inventory.removeItem).toHaveBeenCalledWith(AUTH, ORG, 'item-1');
    expect(inventory.removeItem).toHaveBeenCalledWith(AUTH, ORG, 'item-2');
    expect(prisma.purchase.deleteMany).toHaveBeenCalledWith({
      where: { id: 'purchase-1', organizationId: ORG },
    });
  });

  it("ne supprime pas l'achat d'une autre organisation", async () => {
    prisma.purchase.findFirst.mockResolvedValue(null);

    await expect(service.remove(AUTH, ORG, 'purchase-b')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.purchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'purchase-b', organizationId: ORG },
      }),
    );
    expect(inventory.removeItem).not.toHaveBeenCalled();
  });

  it("donne le coût d'achat d'un exemplaire du stock", async () => {
    prisma.purchaseLine.findFirst.mockResolvedValue({
      purchaseId: 'purchase-1',
      cost: new Prisma.Decimal('18.4'),
      purchase: savedPurchase(),
    });

    expect(await service.getItem(AUTH, ORG, 'item-1')).toEqual({
      purchaseId: 'purchase-1',
      supplier: 'Vinted',
      purchasedAt: '2026-10-13',
      cost: '18.40',
    });
    expect(prisma.purchaseLine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inventoryItemId: 'item-1', purchase: { organizationId: ORG } },
      }),
    );
  });
});
