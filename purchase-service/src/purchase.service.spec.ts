import {
  BadRequestException,
  ForbiddenException,
  Logger,
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

const savedLine = (id: string, inventoryItemId: string) => ({
  id,
  purchaseId: 'purchase-1',
  position: 0,
  inventoryItemId,
  productId: 'product-1',
  productName: 'Dracaufeu-ex',
  productType: 'SINGLE',
  setCode: 'MEW',
  setName: '151',
  cardNumber: '006',
  imageUrl: null,
  condition: 'NEAR_MINT',
  language: 'FRENCH',
  gradingCompany: null,
  grade: null,
  reverse: false,
  marketPrice: null,
  cost: new Prisma.Decimal(30),
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
  let inventory: {
    addItems: jest.Mock;
    removeItems: jest.Mock;
    findItems: jest.Mock;
  };
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
    inventory = {
      addItems: jest.fn(),
      removeItems: jest.fn(),
      findItems: jest.fn(),
    };
    service = new PurchaseService(
      prisma as never,
      identity,
      inventory as never,
    );
  });

  // Inventory crée les exemplaires avec les ids reçus, chacun avec son prix,
  // et les renvoie dans un autre ordre.
  const stock = (...prices: (string | null)[]) =>
    inventory.addItems.mockImplementation(
      (_auth: string, _org: string, items: { id: string }[]) =>
        Promise.resolve(
          items
            .map(({ id }, index) => inventoryItem(id, prices[index]))
            .reverse(),
        ),
    );

  const sentIds = (): string[] =>
    inventory.addItems.mock.calls[0][2].map(({ id }: { id: string }) => id);

  it('ajoute le lot au stock en une requête et répartit le prix au Price Trend', async () => {
    stock('40.00', '20.00');

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
    expect(inventory.addItems).toHaveBeenCalledTimes(1);
    expect(inventory.addItems).toHaveBeenCalledWith(AUTH, ORG, [
      expect.objectContaining({ productId: 'p1', language: 'FRENCH' }),
      expect.objectContaining({ productId: 'p2', language: 'FRENCH' }),
    ]);
    expect(
      purchase.lines.map(({ inventoryItemId }) => inventoryItemId),
    ).toEqual(sentIds());
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
    stock(null, null, null);

    const purchase = await service.create(
      AUTH,
      ORG,
      lot([line('booster', 3)], 15, 3),
    );

    expect(new Set(sentIds()).size).toBe(3);
    expect(purchase.lines.map(({ cost }) => cost)).toEqual([
      '6.00',
      '6.00',
      '6.00',
    ]);
  });

  it('garde le coût saisi pour une ligne et répartit le reste', async () => {
    stock('10.00', '30.00', '10.00');

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
    expect(inventory.addItems).not.toHaveBeenCalled();
  });

  it('refuse un achat de plus de 100 exemplaires', async () => {
    await expect(
      service.create(AUTH, ORG, lot([line('p1', 60), line('p2', 41)])),
    ).rejects.toThrow(BadRequestException);
    expect(inventory.addItems).not.toHaveBeenCalled();
  });

  it('ne retire rien quand inventory refuse le lot, qui n’est pas entré au stock', async () => {
    inventory.addItems.mockRejectedValue(
      new BadRequestException('Langue invalide'),
    );

    await expect(
      service.create(AUTH, ORG, lot([line('p1'), line('p2')])),
    ).rejects.toThrow(BadRequestException);
    expect(inventory.removeItems).not.toHaveBeenCalled();
    expect(prisma.purchase.create).not.toHaveBeenCalled();
  });

  it('retire le lot par ses ids quand inventory ne répond pas à temps', async () => {
    inventory.addItems.mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );

    await expect(service.create(AUTH, ORG, lot([line('p1')]))).rejects.toThrow(
      'timed out',
    );
    expect(inventory.removeItems).toHaveBeenCalledWith(AUTH, ORG, sentIds());
  });

  it('retire le lot du stock si l’achat ne peut être enregistré', async () => {
    stock('10.00');
    prisma.purchase.create.mockRejectedValue(new Error('base indisponible'));

    await expect(service.create(AUTH, ORG, lot([line('p1')]))).rejects.toThrow(
      'base indisponible',
    );
    expect(inventory.removeItems).toHaveBeenCalledWith(AUTH, ORG, sentIds());
  });

  it('logge les exemplaires restés au stock si leur retrait échoue', async () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    stock('10.00');
    prisma.purchase.create.mockRejectedValue(new Error('base indisponible'));
    inventory.removeItems.mockRejectedValue(
      new Error('inventory indisponible'),
    );

    await expect(service.create(AUTH, ORG, lot([line('p1')]))).rejects.toThrow(
      'base indisponible',
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(sentIds()[0]),
      expect.anything(),
    );
    logError.mockRestore();
  });

  it('refuse l’achat sans la permission, avant de toucher au stock', async () => {
    identity.requirePermission.mockRejectedValue(new ForbiddenException());

    await expect(service.create(AUTH, ORG, lot([line('p1')]))).rejects.toThrow(
      ForbiddenException,
    );
    expect(inventory.addItems).not.toHaveBeenCalled();
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

  it('signale les exemplaires d’un achat qui ne sont plus au stock', async () => {
    prisma.purchase.findFirst.mockResolvedValue(
      savedPurchase([
        savedLine('line-1', 'item-1'),
        savedLine('line-2', 'item-2'),
      ]),
    );
    inventory.findItems.mockResolvedValue([inventoryItem('item-2', null)]);

    const purchase = await service.get(AUTH, ORG, 'purchase-1');

    expect(inventory.findItems).toHaveBeenCalledWith(AUTH, ORG, [
      'item-1',
      'item-2',
    ]);
    expect(purchase.lines.map(({ inStock }) => inStock)).toEqual([false, true]);
  });

  it('supprime un achat en retirant ses exemplaires du stock en une requête', async () => {
    prisma.purchase.findFirst.mockResolvedValue(
      savedPurchase([
        savedLine('line-1', 'item-1'),
        savedLine('line-2', 'item-2'),
      ]),
    );

    await service.remove(AUTH, ORG, 'purchase-1');

    expect(inventory.removeItems).toHaveBeenCalledWith(AUTH, ORG, [
      'item-1',
      'item-2',
    ]);
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
    expect(inventory.removeItems).not.toHaveBeenCalled();
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
