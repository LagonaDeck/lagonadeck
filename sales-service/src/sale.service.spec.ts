import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from './generated/prisma/client';
import { SaleService } from './sale.service';

const USER_ID = 'user-1';
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
    id: 'product-1',
    name: 'Dracaufeu-ex',
    productType: 'SINGLE',
    setCode: 'MEW',
    setName: '151',
    cardNumber: '006',
    imageUrl: null,
  },
});

const sold = (
  lines: { inventoryItemId: string; unitPrice?: number }[],
  price = 60,
  fees = 0,
) => ({ buyer: 'Cardmarket', soldAt: '2026-11-24', price, fees, lines });

const item = (inventoryItemId: string) => ({ inventoryItemId });

const savedSale = (lines: object[] = []) => ({
  id: 'sale-1',
  organizationId: ORG,
  buyer: 'Cardmarket',
  soldAt: new Date('2026-11-24'),
  price: new Prisma.Decimal(60),
  fees: new Prisma.Decimal(0),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lines,
});

const savedLine = (inventoryItemId: string, cost: string | null) => ({
  id: `line-${inventoryItemId}`,
  saleId: 'sale-1',
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
  price: new Prisma.Decimal(30),
  fees: new Prisma.Decimal(2),
  cost: cost === null ? null : new Prisma.Decimal(cost),
});

describe('SaleService', () => {
  let prisma: {
    sale: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      deleteMany: jest.Mock;
      aggregate: jest.Mock;
    };
    saleLine: { groupBy: jest.Mock; count: jest.Mock; aggregate: jest.Mock };
  };
  let identity: { getPermissions: jest.Mock; requirePermission: jest.Mock };
  let inventory: {
    addItems: jest.Mock;
    removeItems: jest.Mock;
    findItems: jest.Mock;
  };
  let purchase: { findItems: jest.Mock };
  let service: SaleService;

  beforeEach(() => {
    prisma = {
      sale: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        // Renvoie la vente telle qu'elle serait enregistrée, lignes comprises.
        create: jest.fn(({ data }) =>
          Promise.resolve({
            ...savedSale(
              data.lines.create.map(
                (
                  created: { marketPrice: string | null; cost: string | null },
                  index: number,
                ) => ({
                  ...created,
                  id: `line-${index}`,
                  saleId: 'sale-1',
                  marketPrice:
                    created.marketPrice &&
                    new Prisma.Decimal(created.marketPrice),
                  cost: created.cost && new Prisma.Decimal(created.cost),
                  grade: null,
                }),
              ),
            ),
            price: new Prisma.Decimal(data.price),
            fees: new Prisma.Decimal(data.fees),
          }),
        ),
        deleteMany: jest.fn(),
        aggregate: jest.fn(),
      },
      saleLine: { groupBy: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    };
    identity = { getPermissions: jest.fn(), requirePermission: jest.fn() };
    inventory = {
      addItems: jest.fn(),
      removeItems: jest.fn(),
      findItems: jest.fn(),
    };
    purchase = { findItems: jest.fn().mockResolvedValue([]) };
    service = new SaleService(
      prisma as never,
      identity,
      inventory as never,
      purchase,
    );
  });

  // Inventory renvoie les exemplaires au stock dans un autre ordre.
  const inStock = (...items: ReturnType<typeof inventoryItem>[]) =>
    inventory.findItems.mockResolvedValue([...items].reverse());

  const purchasedAt = (...items: [string, string][]) =>
    purchase.findItems.mockResolvedValue(
      items.map(([inventoryItemId, cost]) => ({ inventoryItemId, cost })),
    );

  it('sort les exemplaires du stock en une requête et répartit le prix au Price Trend', async () => {
    inStock(inventoryItem('item-1', '40.00'), inventoryItem('item-2', '20.00'));

    const sale = await service.create(
      USER_ID,
      ORG,
      sold([item('item-1'), item('item-2')]),
    );

    expect(identity.requirePermission).toHaveBeenCalledWith(
      USER_ID,
      ORG,
      'SALE_MANAGE',
    );
    expect(inventory.removeItems).toHaveBeenCalledTimes(1);
    expect(inventory.removeItems).toHaveBeenCalledWith(USER_ID, ORG, [
      'item-1',
      'item-2',
    ]);
    expect(sale.lines.map(({ inventoryItemId }) => inventoryItemId)).toEqual([
      'item-1',
      'item-2',
    ]);
    expect(sale.lines.map(({ price }) => price)).toEqual(['40.00', '20.00']);
  });

  it('enregistre la vente avant de sortir les exemplaires du stock', async () => {
    inStock(inventoryItem('item-1', null));
    let savedFirst = false;
    inventory.removeItems.mockImplementation(() => {
      savedFirst = prisma.sale.create.mock.calls.length > 0;
      return Promise.resolve();
    });

    await service.create(USER_ID, ORG, sold([item('item-1')]));

    expect(savedFirst).toBe(true);
  });

  it('répartit les frais au prorata du prix et calcule la marge sur le coût d’achat', async () => {
    inStock(inventoryItem('item-1', '30.00'), inventoryItem('item-2', '10.00'));
    purchasedAt(['item-1', '20.00'], ['item-2', '5.00']);

    const sale = await service.create(
      USER_ID,
      ORG,
      sold([item('item-1'), item('item-2')], 40, 4),
    );

    expect(purchase.findItems).toHaveBeenCalledWith(USER_ID, ORG, [
      'item-1',
      'item-2',
    ]);
    expect(
      sale.lines.map(({ price, fees, cost, margin }) => ({
        price,
        fees,
        cost,
        margin,
      })),
    ).toEqual([
      { price: '30.00', fees: '3.00', cost: '20.00', margin: '7.00' },
      { price: '10.00', fees: '1.00', cost: '5.00', margin: '4.00' },
    ]);
    expect(sale).toEqual(
      expect.objectContaining({
        revenue: '36.00',
        cost: '25.00',
        margin: '11.00',
        uncostedItemCount: 0,
      }),
    );
  });

  it('vend sans coût un exemplaire entré au stock hors achat, sans le compter dans la marge', async () => {
    inStock(inventoryItem('item-1', '30.00'), inventoryItem('item-2', '30.00'));
    purchasedAt(['item-1', '20.00']);

    const sale = await service.create(
      USER_ID,
      ORG,
      sold([item('item-1'), item('item-2')]),
    );

    expect(sale.lines.map(({ cost, margin }) => ({ cost, margin }))).toEqual([
      { cost: '20.00', margin: '10.00' },
      { cost: null, margin: null },
    ]);
    expect(sale).toEqual(
      expect.objectContaining({ margin: '10.00', uncostedItemCount: 1 }),
    );
  });

  it('garde le prix saisi pour un exemplaire et répartit le reste', async () => {
    inStock(
      inventoryItem('item-1', '10.00'),
      inventoryItem('item-2', '30.00'),
      inventoryItem('item-3', '10.00'),
    );

    const sale = await service.create(
      USER_ID,
      ORG,
      sold(
        [
          { inventoryItemId: 'item-1', unitPrice: 50 },
          item('item-2'),
          item('item-3'),
        ],
        90,
      ),
    );

    expect(sale.lines.map(({ price }) => price)).toEqual([
      '50.00',
      '30.00',
      '10.00',
    ]);
  });

  it('refuse des prix saisis supérieurs à la vente sans toucher au stock', async () => {
    await expect(
      service.create(
        USER_ID,
        ORG,
        sold([{ inventoryItemId: 'item-1', unitPrice: 80 }], 60),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(inventory.findItems).not.toHaveBeenCalled();
  });

  it('refuse un exemplaire absent du stock', async () => {
    inStock(inventoryItem('item-1', null));

    await expect(
      service.create(USER_ID, ORG, sold([item('item-1'), item('item-2')])),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.sale.create).not.toHaveBeenCalled();
    expect(inventory.removeItems).not.toHaveBeenCalled();
  });

  it('refuse un exemplaire déjà vendu par une autre vente', async () => {
    inStock(inventoryItem('item-1', null));
    prisma.sale.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7',
      }),
    );

    await expect(
      service.create(USER_ID, ORG, sold([item('item-1')])),
    ).rejects.toMatchObject({ status: 409 });
    expect(inventory.removeItems).not.toHaveBeenCalled();
  });

  it('annule la vente quand inventory refuse la sortie du stock', async () => {
    inStock(inventoryItem('item-1', null));
    inventory.removeItems.mockRejectedValue(new ForbiddenException());

    await expect(
      service.create(USER_ID, ORG, sold([item('item-1')])),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.sale.deleteMany).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
    });
  });

  it('annule la vente et logge les exemplaires quand inventory ne répond pas à temps', async () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    inStock(inventoryItem('item-1', null));
    inventory.removeItems.mockRejectedValue(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );

    await expect(
      service.create(USER_ID, ORG, sold([item('item-1')])),
    ).rejects.toThrow('timed out');
    expect(prisma.sale.deleteMany).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
    });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('item-1'),
      expect.anything(),
    );
    logError.mockRestore();
  });

  it('refuse la vente sans la permission, avant de toucher au stock', async () => {
    identity.requirePermission.mockRejectedValue(new ForbiddenException());

    await expect(
      service.create(USER_ID, ORG, sold([item('item-1')])),
    ).rejects.toThrow(ForbiddenException);
    expect(inventory.findItems).not.toHaveBeenCalled();
  });

  it("ne liste que les ventes de l'organisation, avec leur marge", async () => {
    prisma.sale.findMany.mockResolvedValue([savedSale()]);
    prisma.saleLine.groupBy
      .mockResolvedValueOnce([{ saleId: 'sale-1', _count: { _all: 3 } }])
      .mockResolvedValueOnce([
        {
          saleId: 'sale-1',
          _count: { _all: 2 },
          _sum: {
            price: new Prisma.Decimal(50),
            fees: new Prisma.Decimal(5),
            cost: new Prisma.Decimal(30),
          },
        },
      ]);

    const [sale] = await service.list(USER_ID, ORG, { take: 20, skip: 0 });

    expect(identity.getPermissions).toHaveBeenCalledWith(USER_ID, ORG);
    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG } }),
    );
    expect(sale).toEqual(
      expect.objectContaining({
        soldAt: '2026-11-24',
        itemCount: 3,
        cost: '30.00',
        margin: '15.00',
        uncostedItemCount: 1,
      }),
    );
  });

  it('résume les ventes de la période', async () => {
    prisma.sale.aggregate.mockResolvedValue({
      _count: { _all: 2 },
      _sum: { price: new Prisma.Decimal(100), fees: new Prisma.Decimal(8) },
    });
    prisma.saleLine.count.mockResolvedValue(4);
    prisma.saleLine.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _sum: {
        price: new Prisma.Decimal(80),
        fees: new Prisma.Decimal(6),
        cost: new Prisma.Decimal(50),
      },
    });

    const summary = await service.summary(USER_ID, ORG, {
      from: '2026-11-01',
      to: '2026-11-30',
    });

    expect(prisma.sale.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          soldAt: {
            gte: new Date('2026-11-01'),
            lte: new Date('2026-11-30'),
          },
        },
      }),
    );
    expect(summary).toEqual({
      saleCount: 2,
      itemCount: 4,
      revenue: '92.00',
      cost: '50.00',
      margin: '24.00',
      uncostedItemCount: 1,
    });
  });

  it('supprime une vente en remettant ses exemplaires au stock, tels qu’ils en sont sortis', async () => {
    prisma.sale.findFirst.mockResolvedValue(
      savedSale([savedLine('item-1', '20.00'), savedLine('item-2', null)]),
    );
    inventory.findItems.mockResolvedValue([]);

    await service.remove(USER_ID, ORG, 'sale-1');

    expect(inventory.addItems).toHaveBeenCalledWith(USER_ID, ORG, [
      expect.objectContaining({
        id: 'item-1',
        productId: 'product-1',
        condition: 'NEAR_MINT',
        language: 'FRENCH',
        reverse: false,
      }),
      expect.objectContaining({ id: 'item-2' }),
    ]);
    expect(prisma.sale.deleteMany).toHaveBeenCalledWith({
      where: { id: 'sale-1', organizationId: ORG },
    });
  });

  it('ne remet pas au stock un exemplaire déjà remis par un essai précédent', async () => {
    prisma.sale.findFirst.mockResolvedValue(
      savedSale([savedLine('item-1', null), savedLine('item-2', null)]),
    );
    inventory.findItems.mockResolvedValue([inventoryItem('item-1', null)]);

    await service.remove(USER_ID, ORG, 'sale-1');

    expect(inventory.addItems).toHaveBeenCalledWith(USER_ID, ORG, [
      expect.objectContaining({ id: 'item-2' }),
    ]);
  });

  it('garde la vente si ses exemplaires ne peuvent être remis au stock', async () => {
    prisma.sale.findFirst.mockResolvedValue(
      savedSale([savedLine('item-1', null)]),
    );
    inventory.findItems.mockResolvedValue([]);
    inventory.addItems.mockRejectedValue(new ForbiddenException());

    await expect(service.remove(USER_ID, ORG, 'sale-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.sale.deleteMany).not.toHaveBeenCalled();
  });

  it("ne supprime pas la vente d'une autre organisation", async () => {
    prisma.sale.findFirst.mockResolvedValue(null);

    await expect(service.remove(USER_ID, ORG, 'sale-b')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.sale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sale-b', organizationId: ORG } }),
    );
    expect(inventory.addItems).not.toHaveBeenCalled();
  });
});
