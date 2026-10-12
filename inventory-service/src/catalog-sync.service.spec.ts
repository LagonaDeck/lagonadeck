import { CatalogSyncService, productTypeOf } from './catalog-sync.service';

const URL = 'https://downloads.s3.cardmarket.com/productCatalog/x.json';
const HOUR = 60 * 60 * 1000;

describe('productTypeOf', () => {
  it.each([
    ['Pokémon Elite Trainer Boxes', 'ELITE_TRAINER_BOX'],
    ['Pokémon Display', 'BOOSTER_DISPLAY'],
    ['Pokémon Booster', 'BOOSTER'],
    ['Pokémon Tins', 'TIN'],
    ['Pokémon Theme Decks', 'PRECONSTRUCTED_DECK'],
    ['Pokémon Box Set', 'BOX_SET'],
    ['Pokémon Coins', 'OTHER'],
  ])('classe la catégorie Cardmarket « %s » en %s', (category, type) => {
    expect(productTypeOf(category)).toBe(type);
  });
});

describe('CatalogSyncService', () => {
  let prisma: {
    syncedFile: { findUnique: jest.Mock; upsert: jest.Mock };
    product: { findMany: jest.Mock };
    cardmarketProduct: { findMany: jest.Mock };
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let fetchMock: jest.SpyInstance;
  let service: CatalogSyncService;

  beforeEach(() => {
    prisma = {
      syncedFile: { findUnique: jest.fn(), upsert: jest.fn() },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      cardmarketProduct: { findMany: jest.fn().mockResolvedValue([]) },
      $executeRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    fetchMock = jest.spyOn(global, 'fetch');
    service = new CatalogSyncService(prisma as never);
  });

  afterEach(() => fetchMock.mockRestore());

  it('ne retélécharge pas un fichier synchronisé il y a moins de 24 h', async () => {
    prisma.syncedFile.findUnique.mockResolvedValue({
      url: URL,
      etag: '"a"',
      syncedAt: new Date(Date.now() - HOUR),
    });
    const apply = jest.fn();

    await service.syncFile(URL, apply);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("n'importe pas un fichier inchangé depuis la dernière synchronisation (ETag)", async () => {
    prisma.syncedFile.findUnique.mockResolvedValue({
      url: URL,
      etag: '"a"',
      syncedAt: new Date(Date.now() - 25 * HOUR),
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 304 }));
    const apply = jest.fn();

    await service.syncFile(URL, apply);

    expect(fetchMock.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ 'if-none-match': '"a"' }),
    );
    expect(apply).not.toHaveBeenCalled();
    expect(prisma.syncedFile.upsert).toHaveBeenCalled();
  });

  it('garde les dernières données et retente au prochain passage si le téléchargement échoue', async () => {
    prisma.syncedFile.findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const apply = jest.fn();

    await expect(service.syncFile(URL, apply)).rejects.toThrow('HTTP 503');

    expect(apply).not.toHaveBeenCalled();
    expect(prisma.syncedFile.upsert).not.toHaveBeenCalled();
  });

  it('importe un nouveau fichier et retient son ETag', async () => {
    prisma.syncedFile.findUnique.mockResolvedValue(null);
    fetchMock.mockResolvedValue(
      new Response('{}', { headers: { etag: '"b"' } }),
    );
    const apply = jest.fn();

    await service.syncFile(URL, apply);

    expect(apply).toHaveBeenCalledWith(expect.any(Response));
    expect(prisma.syncedFile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { url: URL, etag: '"b"', syncedAt: expect.any(Date) },
      }),
    );
  });

  it('crée les produits scellés depuis le catalogue Cardmarket', async () => {
    await service.importCardmarketProducts(
      {
        products: [
          {
            idProduct: 719691,
            name: '151 Elite Trainer Box',
            categoryName: 'Pokémon Elite Trainer Boxes',
            idExpansion: 5402,
          },
        ],
      },
      false,
    );

    const values: unknown[] = prisma.$executeRaw.mock.calls[1].slice(1);
    expect(values).toContain(
      JSON.stringify([
        {
          cardmarketId: 719691,
          name: '151 Elite Trainer Box',
          productType: 'ELITE_TRAINER_BOX',
          searchText: '151 elite trainer box etb',
        },
      ]),
    );
  });

  it('ne recalcule que les liens qui changent', async () => {
    prisma.product.findMany
      .mockResolvedValueOnce([
        {
          id: 'empoleon',
          moves: ['Rushing Water', 'Escort'],
          tcgdexCardmarketIds: [278718],
          cardmarketId: null,
        },
        {
          id: 'mewtwo',
          moves: ['Shatter Shot'],
          tcgdexCardmarketIds: [286307],
          cardmarketId: 286307,
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.cardmarketProduct.findMany.mockResolvedValue([
      { id: 278718, name: 'Empoleon [FB] Lv.50 [Rushing Water | Escort]' },
      { id: 286307, name: 'Mewtwo EX [Photon Wave | Psyburn]' },
    ]);

    await service.linkCards();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const values: unknown[] = prisma.$executeRaw.mock.calls[0].slice(1);
    expect(values).toContain(
      JSON.stringify([
        { id: 'empoleon', cardmarketId: 278718 },
        { id: 'mewtwo', cardmarketId: null },
      ]),
    );
  });
});
