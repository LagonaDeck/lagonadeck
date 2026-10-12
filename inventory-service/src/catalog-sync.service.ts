import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { gunzipSync } from 'node:zlib';
import { cardmarketLinks, readTarFiles, tcgdexCards } from './card-details';
import { PrismaClient } from './generated/prisma/client';
import { ProductSource, ProductType } from './generated/prisma/enums';
import { toSearchText } from './product.service';

const CARDMARKET_URL = 'https://downloads.s3.cardmarket.com/productCatalog';
// `idGame` Cardmarket de Pokémon.
const CARDMARKET_POKEMON = 6;
const TCGDEX_ARCHIVE_URL =
  'https://codeload.github.com/tcgdex/cards-database/tar.gz/refs/heads/master';
const HEADERS = { 'user-agent': 'LagonaDeck/1.0' };
const SYNC_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const SYNC_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

interface CardmarketFileProduct {
  idProduct: number;
  name: string;
  categoryName: string;
  idExpansion: number | null;
}

type CardmarketFilePrice = Record<string, number | null> & {
  idProduct: number;
};

// L'ordre compte : « Booster Box » est un display.
const PRODUCT_TYPE_RULES: [RegExp, ProductType][] = [
  [/elite trainer/i, ProductType.ELITE_TRAINER_BOX],
  [/display|booster box/i, ProductType.BOOSTER_DISPLAY],
  [/booster/i, ProductType.BOOSTER],
  [/\btins?\b/i, ProductType.TIN],
  [/bundle/i, ProductType.BUNDLE],
  [/deck/i, ProductType.PRECONSTRUCTED_DECK],
  [/box set|gift set|collection/i, ProductType.BOX_SET],
];

export const productTypeOf = (categoryName: string): ProductType =>
  PRODUCT_TYPE_RULES.find(([pattern]) => pattern.test(categoryName))?.[1] ??
  ProductType.OTHER;

// Abréviation courante, cherchée par les vendeurs.
const SEARCH_ALIASES: Partial<Record<ProductType, string>> = {
  ELITE_TRAINER_BOX: 'etb',
};

/**
 * Catalogue Pokémon : les cartes viennent de TCGdex, les produits scellés et
 * les prix de Cardmarket. Chaque fichier est indépendant : un fichier absent
 * ou en échec n'efface rien, les produits gardent leurs dernières données.
 */
@Injectable()
export class CatalogSyncService implements OnModuleInit {
  private readonly logger = new Logger(CatalogSyncService.name);
  private running = false;

  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  onModuleInit() {
    const run = () =>
      void this.syncAll().catch((error) =>
        this.logger.error(`Échec de la synchronisation : ${error}`),
      );
    run();
    setInterval(run, SYNC_CHECK_INTERVAL_MS).unref();
  }

  async syncAll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const sources: [string, string, (response: Response) => Promise<void>][] =
        [
          [
            'Cartes Cardmarket',
            `${CARDMARKET_URL}/productList/products_singles_${CARDMARKET_POKEMON}.json`,
            async (response) =>
              this.importCardmarketProducts(await response.json(), true),
          ],
          [
            'Produits scellés Cardmarket',
            `${CARDMARKET_URL}/productList/products_nonsingles_${CARDMARKET_POKEMON}.json`,
            async (response) =>
              this.importCardmarketProducts(await response.json(), false),
          ],
          [
            'Price guide Cardmarket',
            `${CARDMARKET_URL}/priceGuide/price_guide_${CARDMARKET_POKEMON}.json`,
            async (response) => this.importPrices(await response.json()),
          ],
          [
            'Cartes TCGdex',
            TCGDEX_ARCHIVE_URL,
            (response) => this.importTcgdexCards(response),
          ],
        ];
      for (const [label, url, apply] of sources) {
        await this.syncFile(url, apply).catch((error) =>
          this.logger.error(
            `${label} : échec de la synchronisation : ${String(error)}`,
          ),
        );
      }
    } finally {
      this.running = false;
    }
  }

  async syncFile(
    url: string,
    apply: (response: Response) => Promise<void>,
  ): Promise<void> {
    const state = await this.prisma.syncedFile.findUnique({ where: { url } });
    if (state && Date.now() - state.syncedAt.getTime() < SYNC_MAX_AGE_MS) {
      return;
    }

    const response = await fetch(url, {
      headers: state ? { ...HEADERS, 'if-none-match': state.etag } : HEADERS,
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (response.status !== 304) {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await apply(response);
    }

    const etag = response.headers.get('etag') ?? state?.etag ?? '';
    const syncedAt = new Date();
    await this.prisma.syncedFile.upsert({
      where: { url },
      create: { url, etag, syncedAt },
      update: { etag, syncedAt },
    });
  }

  async importCardmarketProducts(
    body: unknown,
    single: boolean,
  ): Promise<void> {
    const { products } = body as { products: CardmarketFileProduct[] };
    const rows = products.map((product) => ({
      id: product.idProduct,
      name: product.name,
      categoryName: product.categoryName,
      expansionId: product.idExpansion,
    }));
    const changed = await this.prisma.$executeRaw`
      INSERT INTO "CardmarketProduct" ("id", "name", "categoryName", "expansionId", "single")
      SELECT p."id", p."name", p."categoryName", p."expansionId", ${single}
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS p(
        "id" int, "name" text, "categoryName" text, "expansionId" int
      )
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name",
        "categoryName" = EXCLUDED."categoryName",
        "expansionId" = EXCLUDED."expansionId",
        "single" = EXCLUDED."single"
      WHERE ("CardmarketProduct"."name", "CardmarketProduct"."categoryName",
          "CardmarketProduct"."expansionId", "CardmarketProduct"."single")
        IS DISTINCT FROM (EXCLUDED."name", EXCLUDED."categoryName",
          EXCLUDED."expansionId", EXCLUDED."single")`;
    this.logger.log(
      `Cardmarket : ${changed} ${single ? 'cartes' : 'produits scellés'} ajoutés ou modifiés`,
    );
    if (single) await this.linkCards();
    else await this.importSealedProducts(products);
  }

  // Cardmarket est la source des produits scellés, absents de TCGdex. Un
  // produit lié à la main par un utilisateur n'est pas modifié.
  private async importSealedProducts(
    products: CardmarketFileProduct[],
  ): Promise<void> {
    const rows = products.map((product) => {
      const productType = productTypeOf(product.categoryName);
      return {
        cardmarketId: product.idProduct,
        name: product.name,
        productType,
        searchText: toSearchText(product.name, SEARCH_ALIASES[productType]),
      };
    });
    const changed = await this.prisma.$executeRaw`
      INSERT INTO "Product"
        ("id", "source", "productType", "name", "englishName", "cardmarketId", "searchText", "updatedAt")
      SELECT gen_random_uuid(), 'CARDMARKET', p."productType"::"ProductType", p."name",
        p."name", p."cardmarketId", p."searchText", now()
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS p(
        "cardmarketId" int, "name" text, "productType" text, "searchText" text
      )
      ON CONFLICT ("cardmarketId") DO UPDATE SET
        "name" = EXCLUDED."name",
        "englishName" = EXCLUDED."englishName",
        "productType" = EXCLUDED."productType",
        "searchText" = EXCLUDED."searchText",
        "updatedAt" = now()
      WHERE "Product"."source" = 'CARDMARKET'
        AND ("Product"."name", "Product"."productType", "Product"."searchText")
          IS DISTINCT FROM (EXCLUDED."name", EXCLUDED."productType", EXCLUDED."searchText")`;
    this.logger.log(`Produits scellés : ${changed} ajoutés ou modifiés`);
  }

  // Un prix absent du fichier du jour ne remplace pas le dernier prix connu.
  async importPrices(body: unknown): Promise<void> {
    const { createdAt, priceGuides } = body as {
      createdAt: string;
      priceGuides: CardmarketFilePrice[];
    };
    const rows = priceGuides.map((price) => ({
      id: price.idProduct,
      trend: price.trend,
      low: price.low,
      avg1: price.avg1,
      avg7: price.avg7,
      avg30: price.avg30,
      trendHolo: price['trend-holo'],
    }));
    const updated = await this.prisma.$executeRaw`
      UPDATE "CardmarketProduct" AS c SET
        "trend" = coalesce(g."trend", c."trend"),
        "low" = coalesce(g."low", c."low"),
        "avg1" = coalesce(g."avg1", c."avg1"),
        "avg7" = coalesce(g."avg7", c."avg7"),
        "avg30" = coalesce(g."avg30", c."avg30"),
        "trendHolo" = coalesce(g."trendHolo", c."trendHolo"),
        "priceDate" = ${createdAt}::timestamptz AT TIME ZONE 'UTC'
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS g(
        "id" int, "trend" numeric, "low" numeric, "avg1" numeric,
        "avg7" numeric, "avg30" numeric, "trendHolo" numeric
      )
      WHERE c."id" = g."id"`;
    // Un relevé par produit et par jour : un nouvel import du même jour le remplace.
    const recorded = await this.prisma.$executeRaw`
      INSERT INTO "PriceSnapshot" ("cardmarketId", "date", "trend", "low", "avg1", "avg7", "avg30")
      SELECT c."id", c."priceDate"::date, c."trend", c."low", c."avg1", c."avg7", c."avg30"
      FROM "CardmarketProduct" c
      WHERE c."priceDate" = ${createdAt}::timestamptz AT TIME ZONE 'UTC'
        AND c."trend" IS NOT NULL
      ON CONFLICT ("cardmarketId", "date") DO UPDATE SET
        "trend" = EXCLUDED."trend",
        "low" = EXCLUDED."low",
        "avg1" = EXCLUDED."avg1",
        "avg7" = EXCLUDED."avg7",
        "avg30" = EXCLUDED."avg30"`;
    this.logger.log(
      `Cardmarket : ${updated} prix mis à jour, ${recorded} relevés enregistrés`,
    );
  }

  async importTcgdexCards(response: Response): Promise<void> {
    const archive = gunzipSync(Buffer.from(await response.arrayBuffer()));
    const cards = tcgdexCards(
      readTarFiles(archive, (path) => path.endsWith('.ts')),
    ).map((card) => ({
      ...card,
      searchText: toSearchText(
        card.name,
        card.englishName,
        card.setCode,
        card.setName,
        card.cardNumber,
        card.cardNumber.replace(/^0+(?=\d)/, ''),
      ),
    }));
    const changed = await this.prisma.$executeRaw`
      INSERT INTO "Product"
        ("id", "source", "productType", "tcgdexId", "name", "englishName", "setCode",
         "setName", "cardNumber", "rarity", "imageUrl", "hasReverse", "moves",
         "tcgdexCardmarketIds", "searchText", "updatedAt")
      SELECT gen_random_uuid(), 'TCGDEX', 'SINGLE', c."tcgdexId", c."name", c."englishName",
        c."setCode", c."setName", c."cardNumber", c."rarity", c."imageUrl", c."hasReverse",
        c."moves", c."cardmarketIds", c."searchText", now()
      FROM jsonb_to_recordset(${JSON.stringify(cards)}::jsonb) AS c(
        "tcgdexId" text, "name" text, "englishName" text, "setCode" text, "setName" text,
        "cardNumber" text, "rarity" text, "imageUrl" text, "hasReverse" boolean, "moves" text[],
        "cardmarketIds" int[], "searchText" text
      )
      ON CONFLICT ("tcgdexId") DO UPDATE SET
        "name" = EXCLUDED."name",
        "englishName" = EXCLUDED."englishName",
        "setCode" = EXCLUDED."setCode",
        "setName" = EXCLUDED."setName",
        "cardNumber" = EXCLUDED."cardNumber",
        "rarity" = EXCLUDED."rarity",
        "imageUrl" = EXCLUDED."imageUrl",
        "hasReverse" = EXCLUDED."hasReverse",
        "moves" = EXCLUDED."moves",
        "tcgdexCardmarketIds" = EXCLUDED."tcgdexCardmarketIds",
        "searchText" = EXCLUDED."searchText",
        "updatedAt" = now()
      WHERE ("Product"."name", "Product"."englishName", "Product"."setCode",
          "Product"."setName", "Product"."cardNumber", "Product"."rarity",
          "Product"."imageUrl", "Product"."hasReverse", "Product"."moves",
          "Product"."tcgdexCardmarketIds", "Product"."searchText")
        IS DISTINCT FROM (EXCLUDED."name", EXCLUDED."englishName", EXCLUDED."setCode",
          EXCLUDED."setName", EXCLUDED."cardNumber", EXCLUDED."rarity",
          EXCLUDED."imageUrl", EXCLUDED."hasReverse", EXCLUDED."moves",
          EXCLUDED."tcgdexCardmarketIds", EXCLUDED."searchText")`;
    this.logger.log(
      `TCGdex : ${cards.length} cartes, ${changed} ajoutées ou modifiées`,
    );
    await this.linkCards();
  }

  // Recalculé quand les cartes TCGdex ou les noms Cardmarket changent. Les
  // liens saisis à la main ne sont ni remplacés ni réattribués.
  async linkCards(): Promise<void> {
    const [cards, reserved, cardmarketCards] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          source: ProductSource.TCGDEX,
          cardmarketLinkedByUser: false,
        },
        select: {
          id: true,
          moves: true,
          tcgdexCardmarketIds: true,
          cardmarketId: true,
        },
      }),
      this.prisma.product.findMany({
        where: {
          cardmarketId: { not: null },
          OR: [
            { source: { not: ProductSource.TCGDEX } },
            { cardmarketLinkedByUser: true },
          ],
        },
        select: { cardmarketId: true },
      }),
      this.prisma.cardmarketProduct.findMany({
        where: { single: true },
        select: { id: true, name: true },
      }),
    ]);
    const links = cardmarketLinks(
      cards,
      new Map(cardmarketCards.map(({ id, name }) => [id, name])),
      new Set(reserved.map(({ cardmarketId }) => cardmarketId as number)),
    );
    const changes = cards
      .map((card) => ({
        id: card.id,
        cardmarketId: links.get(card.id) ?? null,
      }))
      .filter(
        (change, index) => change.cardmarketId !== cards[index].cardmarketId,
      );
    if (changes.length > 0) {
      const json = JSON.stringify(changes);
      // Deux temps : un identifiant passe d'une carte à l'autre sans
      // jamais être porté par deux cartes à la fois.
      await this.prisma.$transaction([
        this.prisma.$executeRaw`
          UPDATE "Product" SET "cardmarketId" = NULL, "updatedAt" = now()
          FROM jsonb_to_recordset(${json}::jsonb) AS l("id" uuid, "cardmarketId" int)
          WHERE "Product"."id" = l."id"`,
        this.prisma.$executeRaw`
          UPDATE "Product" SET "cardmarketId" = l."cardmarketId"
          FROM jsonb_to_recordset(${json}::jsonb) AS l("id" uuid, "cardmarketId" int)
          WHERE "Product"."id" = l."id" AND l."cardmarketId" IS NOT NULL`,
      ]);
    }
    this.logger.log(
      `Liens Cardmarket : ${links.size} cartes liées, ${changes.length} changements`,
    );
  }
}
