import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from './generated/prisma/client';
import { InventoryService } from './inventory.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: '7.10.0',
  });

const AUTH = 'Bearer token';

const etb = {
  id: 'product-etb',
  source: 'CARDMARKET',
  productType: 'ELITE_TRAINER_BOX',
  tcgdexId: null,
  name: '151 Elite Trainer Box',
  englishName: '151 Elite Trainer Box',
  setCode: null,
  setName: null,
  cardNumber: null,
  rarity: null,
  imageUrl: null,
  hasReverse: null,
  moves: [],
  tcgdexCardmarketIds: [],
  cardmarketId: 719691,
  cardmarketLinkedByUser: false,
  cardmarketProduct: {
    id: 719691,
    name: '151 Elite Trainer Box',
    categoryName: 'Pokémon Elite Trainer Boxes',
    expansionId: 5402,
    single: false,
    trend: new Prisma.Decimal('89.9'),
    low: null,
    avg1: null,
    avg7: null,
    avg30: null,
    trendHolo: null,
    priceDate: new Date('2026-10-11T00:44:21Z'),
  },
  searchText: '151 elite trainer box etb',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const charizard = {
  ...etb,
  id: 'product-charizard',
  source: 'TCGDEX',
  name: 'Dracaufeu-ex',
  productType: 'SINGLE',
  hasReverse: true,
  cardmarketId: 715473,
  cardmarketProduct: {
    ...etb.cardmarketProduct,
    id: 715473,
    single: true,
    trend: new Prisma.Decimal('40'),
    trendHolo: new Prisma.Decimal('12.5'),
  },
};

const stockItem = (organizationId: string) => ({
  id: `item-${organizationId}`,
  organizationId,
  productId: etb.id,
  condition: null,
  language: 'FRENCH',
  gradingCompany: null,
  grade: null,
  reverse: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('InventoryService', () => {
  let prisma: {
    inventoryItem: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let identity: { getPermissions: jest.Mock; requirePermission: jest.Mock };
  let products: { getOrThrow: jest.Mock };
  let fetchMock: jest.SpyInstance;
  let service: InventoryService;

  beforeEach(() => {
    prisma = {
      inventoryItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    identity = { getPermissions: jest.fn(), requirePermission: jest.fn() };
    products = { getOrThrow: jest.fn().mockResolvedValue(etb) };
    fetchMock = jest.spyOn(global, 'fetch');
    service = new InventoryService(
      prisma as never,
      identity as never,
      products as never,
    );
  });

  afterEach(() => fetchMock.mockRestore());

  it('ajoute un produit connu au stock avec son prix, sans appeler Cardmarket', async () => {
    prisma.inventoryItem.create.mockResolvedValue(stockItem('org-a'));

    const item = await service.add(AUTH, 'org-a', {
      productId: etb.id,
      language: 'FRENCH',
    });

    expect(identity.requirePermission).toHaveBeenCalledWith(
      AUTH,
      'org-a',
      'INVENTORY_MANAGE',
    );
    expect(item.product).toEqual(
      expect.objectContaining({ id: etb.id, price: '89.90' }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ajoute chaque carte comme un exemplaire distinct, même identique', async () => {
    prisma.inventoryItem.create
      .mockResolvedValueOnce({ ...stockItem('org-a'), id: 'item-1' })
      .mockResolvedValueOnce({ ...stockItem('org-a'), id: 'item-2' });
    const dto = { productId: etb.id, language: 'FRENCH' as const };

    const first = await service.add(AUTH, 'org-a', dto);
    const second = await service.add(AUTH, 'org-a', dto);

    expect(first.id).not.toBe(second.id);
    expect(prisma.inventoryItem.create).toHaveBeenCalledTimes(2);
  });

  it('montre le même prix central dans le stock de chaque organisation', async () => {
    prisma.inventoryItem.findMany
      .mockResolvedValueOnce([{ ...stockItem('org-a'), product: etb }])
      .mockResolvedValueOnce([{ ...stockItem('org-b'), product: etb }]);

    const [a] = await service.list(AUTH, 'org-a', {});
    const [b] = await service.list(AUTH, 'org-b', {});

    expect(a.product).toEqual(b.product);
  });

  it("ne lit que le stock de l'organisation, après avoir vérifié l'appartenance", async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await service.list(AUTH, 'org-a', { take: 20, skip: 0 });

    expect(identity.getPermissions).toHaveBeenCalledWith(AUTH, 'org-a');
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-a' } }),
    );
  });

  it('cherche dans le stock avec la recherche du catalogue', async () => {
    prisma.$transaction.mockResolvedValue([1, [{ id: 'item-org-a' }]]);
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    await service.list(AUTH, 'org-a', { search: 'Dracaufeu' });

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a', id: { in: ['item-org-a'] } },
      }),
    );
  });

  it('lit une ligne du stock avec son produit', async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue({
      ...stockItem('org-a'),
      product: etb,
    });

    const item = await service.get(AUTH, 'org-a', 'item-org-a');

    expect(item.product.name).toBe(etb.name);
    expect(prisma.inventoryItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-org-a', organizationId: 'org-a' },
      }),
    );
  });

  it("ne lit pas la ligne d'une autre organisation (404)", async () => {
    prisma.inventoryItem.findFirst.mockResolvedValue(null);

    await expect(service.get(AUTH, 'org-a', 'item-org-b')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("ne lit rien pour un non-membre (404 d'identity)", async () => {
    identity.getPermissions.mockRejectedValue(new NotFoundException());

    await expect(service.list(AUTH, 'org-b', {})).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
  });

  it('refuse de modifier le stock sans INVENTORY_MANAGE', async () => {
    identity.requirePermission.mockRejectedValue(new ForbiddenException());

    await expect(
      service.add(AUTH, 'org-a', { productId: etb.id, language: 'FRENCH' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it("ne supprime pas la ligne d'une autre organisation (404)", async () => {
    prisma.inventoryItem.delete.mockRejectedValue(prismaError('P2025'));

    await expect(service.remove(AUTH, 'org-a', 'item-org-b')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.inventoryItem.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-org-b', organizationId: 'org-a' },
      }),
    );
  });

  it('renvoie le total du stock, valeur arrondie au centime', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        itemCount: 9,
        value: new Prisma.Decimal('3247.36'),
        unpricedItemCount: 1,
      },
    ]);

    expect(await service.summary(AUTH, 'org-a')).toEqual({
      itemCount: 9,
      value: '3247.36',
      unpricedItemCount: 1,
    });
    expect(identity.getPermissions).toHaveBeenCalledWith(AUTH, 'org-a');
  });

  it("ne calcule pas le total pour un non-membre (404 d'identity)", async () => {
    identity.getPermissions.mockRejectedValue(new NotFoundException());

    await expect(service.summary(AUTH, 'org-b')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("n'ajoute pas un produit absent du catalogue", async () => {
    products.getOrThrow.mockRejectedValue(new NotFoundException());

    await expect(
      service.add(AUTH, 'org-a', {
        productId: 'unknown',
        language: 'FRENCH',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  describe('état et gradation', () => {
    const addCard = (fields: object) =>
      service.add(AUTH, 'org-a', {
        productId: charizard.id,
        language: 'FRENCH',
        ...fields,
      });

    beforeEach(() => products.getOrThrow.mockResolvedValue(charizard));

    it('ajoute une carte brute avec son état', async () => {
      prisma.inventoryItem.create.mockResolvedValue({
        ...stockItem('org-a'),
        condition: 'NEAR_MINT',
      });

      const item = await addCard({ condition: 'NEAR_MINT' });

      expect(item.condition).toBe('NEAR_MINT');
      expect(item.gradingCompany).toBeNull();
    });

    it('ajoute une carte gradée avec sa société et sa note', async () => {
      prisma.inventoryItem.create.mockResolvedValue({
        ...stockItem('org-a'),
        gradingCompany: 'PSA',
        grade: new Prisma.Decimal('9.5'),
      });

      const item = await addCard({ gradingCompany: 'PSA', grade: 9.5 });

      expect(item).toEqual(
        expect.objectContaining({ gradingCompany: 'PSA', grade: 9.5 }),
      );
    });

    it.each([
      ['une carte brute sans état', {}],
      ['une note sans société', { grade: 10 }],
      ['une société sans note', { gradingCompany: 'PSA' }],
      [
        'une carte gradée avec un état',
        { gradingCompany: 'PSA', grade: 10, condition: 'MINT' },
      ],
    ])('refuse %s', async (_, fields) => {
      await expect(addCard(fields)).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
    });

    it('ajoute une reverse, valorisée au prix reverse de Cardmarket', async () => {
      prisma.inventoryItem.create.mockResolvedValue({
        ...stockItem('org-a'),
        condition: 'NEAR_MINT',
        reverse: true,
      });

      const item = await addCard({ condition: 'NEAR_MINT', reverse: true });

      expect(item).toEqual(
        expect.objectContaining({ reverse: true, price: '12.50' }),
      );
    });

    it('valorise une carte normale au Price Trend', async () => {
      prisma.inventoryItem.create.mockResolvedValue({
        ...stockItem('org-a'),
        condition: 'NEAR_MINT',
      });

      const item = await addCard({ condition: 'NEAR_MINT' });

      expect(item.price).toBe('40.00');
    });

    it('ne valorise pas une carte gradée, le Price Trend valant pour une carte brute', async () => {
      prisma.inventoryItem.create.mockResolvedValue({
        ...stockItem('org-a'),
        gradingCompany: 'PSA',
        grade: new Prisma.Decimal('10'),
      });

      const item = await addCard({ gradingCompany: 'PSA', grade: 10 });

      expect(item.price).toBeNull();
    });

    it('ne donne pas de prix à une reverse sans vente sur Cardmarket (0)', async () => {
      products.getOrThrow.mockResolvedValue({
        ...charizard,
        cardmarketProduct: {
          ...charizard.cardmarketProduct,
          trendHolo: new Prisma.Decimal('0'),
        },
      });
      prisma.inventoryItem.create.mockResolvedValue({
        ...stockItem('org-a'),
        condition: 'NEAR_MINT',
        reverse: true,
      });

      const item = await addCard({ condition: 'NEAR_MINT', reverse: true });

      expect(item.price).toBeNull();
    });

    it('refuse une reverse pour une carte qui n’existe pas en reverse', async () => {
      products.getOrThrow.mockResolvedValue({
        ...charizard,
        hasReverse: false,
      });

      await expect(
        addCard({ condition: 'NEAR_MINT', reverse: true }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
    });

    it('accepte une reverse quand TCGdex ne liste pas les variantes', async () => {
      products.getOrThrow.mockResolvedValue({ ...charizard, hasReverse: null });
      prisma.inventoryItem.create.mockResolvedValue({
        ...stockItem('org-a'),
        condition: 'NEAR_MINT',
        reverse: true,
      });

      const item = await addCard({ condition: 'NEAR_MINT', reverse: true });

      expect(item.reverse).toBe(true);
    });

    it('refuse une reverse pour un produit scellé', async () => {
      products.getOrThrow.mockResolvedValue(etb);

      await expect(
        service.add(AUTH, 'org-a', {
          productId: etb.id,
          language: 'FRENCH',
          reverse: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuse de grader un produit scellé', async () => {
      products.getOrThrow.mockResolvedValue(etb);

      await expect(
        service.add(AUTH, 'org-a', {
          productId: etb.id,
          language: 'FRENCH',
          gradingCompany: 'CGC',
          grade: 9,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
