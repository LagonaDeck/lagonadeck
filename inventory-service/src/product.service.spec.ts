import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from './generated/prisma/client';
import {
  ProductService,
  searchCondition,
  toSearchText,
} from './product.service';

const AUTH = 'Bearer token';

const product = (fields: object = {}) => ({
  id: 'product-1',
  source: 'TCGDEX',
  productType: 'SINGLE',
  tcgdexId: 'en/xy8-158',
  name: 'Mewtwo EX',
  englishName: 'Mewtwo EX',
  setCode: 'BKT',
  setName: 'Impulsion Turbo',
  cardNumber: '158',
  rarity: 'Ultra Rare',
  imageUrl: 'https://assets.tcgdex.net/en/xy/xy8/158/high.webp',
  moves: ['Shatter Shot', 'Damage Change'],
  tcgdexCardmarketIds: [286307],
  cardmarketId: null,
  cardmarketProduct: null,
  cardmarketLinkedByUser: false,
  searchText: 'mewtwo ex bkt 158',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...fields,
});

const cardmarketProduct = {
  id: 286404,
  name: 'Mewtwo EX [Shatter Shot | Damage Change]',
  categoryName: 'Pokémon Single',
  expansionId: 1815,
  single: true,
  trend: new Prisma.Decimal('529.95'),
  low: new Prisma.Decimal('400'),
  avg1: null,
  avg7: new Prisma.Decimal('510'),
  avg30: new Prisma.Decimal('500.5'),
  trendHolo: null,
  priceDate: new Date('2026-10-12T00:44:21Z'),
};

describe('toSearchText', () => {
  it.each([
    [['Méga-Dracaufeu X-ex', 'PFL', '013'], 'mega dracaufeu x ex pfl 013'],
    [['Évoli'], 'evoli'],
    [['リザードン'], 'リザードン'],
  ])('normalise %j en « %s »', (parts, text) => {
    expect(toSearchText(...parts)).toBe(text);
  });
});

describe('searchCondition', () => {
  it('cherche chaque mot en début de mot, avec tolérance aux fautes dès 4 lettres', () => {
    expect(searchCondition('Mewtwo EX (BKT 158)').values).toEqual([
      '\\mmewtwo',
      'mewtwo',
      '\\mex',
      '\\mbkt',
      '\\m158',
    ]);
  });
});

describe('ProductService', () => {
  let prisma: {
    product: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirstOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    cardmarketProduct: { findUnique: jest.Mock };
    priceSnapshot: { findMany: jest.Mock };
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let identity: { requireSession: jest.Mock; requireStaff: jest.Mock };
  let service: ProductService;

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirstOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      cardmarketProduct: { findUnique: jest.fn() },
      priceSnapshot: { findMany: jest.fn() },
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    identity = { requireSession: jest.fn(), requireStaff: jest.fn() };
    service = new ProductService(prisma as never, identity as never);
  });

  it('renvoie les résultats de la recherche dans leur ordre de pertinence', async () => {
    prisma.$transaction.mockResolvedValue([1, [{ id: 'b' }, { id: 'a' }]]);
    prisma.product.findMany.mockResolvedValue([
      product({ id: 'a', name: 'Mewtwo' }),
      product({ id: 'b', name: 'Mewtwo EX' }),
    ]);

    const results = await service.search(AUTH, {
      search: 'mewtwo',
      take: 20,
      skip: 0,
    });

    expect(identity.requireSession).toHaveBeenCalledWith(AUTH);
    expect(results.map(({ name }) => name)).toEqual(['Mewtwo EX', 'Mewtwo']);
  });

  it('donne le prix et les moyennes du produit Cardmarket lié', async () => {
    prisma.product.findUnique.mockResolvedValue(
      product({ cardmarketId: 286404, cardmarketProduct }),
    );

    const result = await service.get(AUTH, 'product-1');

    expect(result.price).toBe('529.95');
    expect(result.cardmarket).toEqual(
      expect.objectContaining({ low: '400.00', avg30: '500.50', avg1: null }),
    );
  });

  it('renvoie un prix indisponible pour une carte sans lien Cardmarket', async () => {
    prisma.product.findUnique.mockResolvedValue(product());

    expect(await service.getPrice(AUTH, 'product-1')).toEqual({
      price: null,
      priceUpdatedAt: null,
    });
  });

  it('répond 404 pour un produit inconnu', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(service.get(AUTH, 'unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('crée une carte absente des sources, avec son set et son numéro', async () => {
    prisma.product.create.mockResolvedValue(
      product({ source: 'MANUAL', tcgdexId: null }),
    );

    await service.create(AUTH, {
      name: 'Pikachu',
      productType: 'SINGLE',
      setCode: 'XYP',
      cardNumber: 'XY95',
    });

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'MANUAL',
          name: 'Pikachu',
          setCode: 'XYP',
          cardNumber: 'XY95',
          searchText: 'pikachu xyp xy95',
        }),
      }),
    );
  });

  it('renvoie le produit existant quand une création concurrente a gagné', async () => {
    prisma.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('P2002', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );
    prisma.product.findFirstOrThrow.mockResolvedValue(
      product({ id: 'existing', source: 'MANUAL' }),
    );

    const result = await service.create(AUTH, {
      name: 'Pikachu',
      productType: 'SINGLE',
    });

    expect(prisma.product.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: 'MANUAL',
          productType: 'SINGLE',
          name: 'Pikachu',
          setCode: null,
          cardNumber: null,
        },
      }),
    );
    expect(result.id).toBe('existing');
  });

  it('lie à la main un produit Cardmarket, retiré du produit qui le portait', async () => {
    prisma.product.findUnique.mockResolvedValue(product());
    prisma.cardmarketProduct.findUnique.mockResolvedValue(cardmarketProduct);
    prisma.$transaction.mockResolvedValue([
      { count: 1 },
      product({
        cardmarketId: 286404,
        cardmarketProduct,
        cardmarketLinkedByUser: true,
      }),
    ]);

    const result = await service.linkCardmarket(AUTH, 'product-1', 286404);

    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { cardmarketId: 286404, id: { not: 'product-1' } },
      data: { cardmarketId: null },
    });
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { cardmarketId: 286404, cardmarketLinkedByUser: true },
      }),
    );
    expect(result.price).toBe('529.95');
  });

  it('refuse un identifiant Cardmarket inconnu', async () => {
    prisma.product.findUnique.mockResolvedValue(product());
    prisma.cardmarketProduct.findUnique.mockResolvedValue(null);

    await expect(
      service.linkCardmarket(AUTH, 'product-1', 999),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('réserve la création de produit à l’équipe LagonaDeck', async () => {
    identity.requireStaff.mockRejectedValue(new ForbiddenException());

    await expect(
      service.create(AUTH, { name: 'Pikachu', productType: 'SINGLE' }),
    ).rejects.toThrow(ForbiddenException);
    expect(identity.requireStaff).toHaveBeenCalledWith(AUTH, 'CATALOG_MANAGE');
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('réserve la correction du lien Cardmarket à l’équipe LagonaDeck', async () => {
    identity.requireStaff.mockRejectedValue(new ForbiddenException());

    await expect(
      service.linkCardmarket(AUTH, 'product-1', 286404),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("n'a pas d'historique de prix sans lien Cardmarket", async () => {
    prisma.product.findUnique.mockResolvedValue(product());

    expect(await service.priceHistory(AUTH, 'product-1')).toEqual([]);
    expect(prisma.priceSnapshot.findMany).not.toHaveBeenCalled();
  });

  it('donne les relevés quotidiens du produit Cardmarket lié, du plus ancien au plus récent', async () => {
    prisma.product.findUnique.mockResolvedValue(
      product({ cardmarketId: 286404, cardmarketProduct }),
    );
    prisma.priceSnapshot.findMany.mockResolvedValue([
      {
        cardmarketId: 286404,
        date: new Date('2026-10-11T00:00:00Z'),
        trend: new Prisma.Decimal('480'),
        low: new Prisma.Decimal('19.55'),
      },
      {
        cardmarketId: 286404,
        date: new Date('2026-10-12T00:00:00Z'),
        trend: new Prisma.Decimal('497'),
        low: null,
      },
    ]);

    const history = await service.priceHistory(AUTH, 'product-1');

    expect(prisma.priceSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cardmarketId: 286404 }),
        orderBy: { date: 'asc' },
      }),
    );
    expect(history).toEqual([
      { date: '2026-10-11', trend: '480.00', low: '19.55' },
      { date: '2026-10-12', trend: '497.00', low: null },
    ]);
  });
});
