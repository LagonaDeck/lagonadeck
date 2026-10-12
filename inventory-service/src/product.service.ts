import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  type CardmarketProduct,
  type Product,
} from './generated/prisma/client';
import { ProductSource } from './generated/prisma/enums';
import { CATALOG_MANAGE, IdentityService } from './identity.service';
import {
  CreateProductDto,
  PriceDto,
  PricePointDto,
  ProductDto,
  SearchProductsDto,
} from './product.dto';

const MAX_SEARCH_WORDS = 8;
const HISTORY_DAYS = 365;
// Un mot plus court (« ex », « 25 ») doit être exact : la tolérance aux fautes
// de frappe (`pg_trgm`) le confondrait avec trop d'autres.
const MIN_TYPO_LENGTH = 4;
// Seuil de `<%` (pg_trgm) : « dracofeu » ressemble à « dracaufeu » à 0,46 ; le
// seuil par défaut (0,6) le refuserait.
const TYPO_SIMILARITY = '0.45';

/** Minuscules, sans accents latins ni ponctuation : « Méga-Dracaufeu » → « mega dracaufeu ». */
export const toSearchText = (...parts: (string | null | undefined)[]) =>
  parts
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export type ProductWithCardmarket = Product & {
  cardmarketProduct: CardmarketProduct | null;
};

const WITH_CARDMARKET = { cardmarketProduct: true } as const;

const amount = (value: Prisma.Decimal | null) => value?.toFixed(2) ?? null;

export const toProductDto = (product: ProductWithCardmarket): ProductDto => {
  const cardmarket = product.cardmarketProduct;
  return {
    id: product.id,
    source: product.source,
    productType: product.productType,
    tcgdexId: product.tcgdexId,
    name: product.name,
    englishName: product.englishName,
    setCode: product.setCode,
    setName: product.setName,
    cardNumber: product.cardNumber,
    rarity: product.rarity,
    imageUrl: product.imageUrl,
    hasReverse: product.hasReverse,
    moves: product.moves,
    cardmarketLinkedByUser: product.cardmarketLinkedByUser,
    price: amount(cardmarket?.trend ?? null),
    priceUpdatedAt: cardmarket?.priceDate ?? null,
    cardmarket: cardmarket && {
      id: cardmarket.id,
      name: cardmarket.name,
      categoryName: cardmarket.categoryName,
      trend: amount(cardmarket.trend),
      low: amount(cardmarket.low),
      avg1: amount(cardmarket.avg1),
      avg7: amount(cardmarket.avg7),
      avg30: amount(cardmarket.avg30),
      trendHolo: amount(cardmarket.trendHolo),
      priceDate: cardmarket.priceDate,
    },
  };
};

/**
 * Chaque mot doit commencer un mot du nom (français ou anglais), du set ou du
 * numéro, dans n'importe quel ordre : « Mewtwo EX (BKT 158) », « bkt 158 mewtwo ».
 * À partir de 4 lettres, un mot proche suffit : « Dracofeu » trouve « Dracaufeu ».
 */
const searchWords = (search: string | undefined) =>
  toSearchText(search).split(' ').filter(Boolean).slice(0, MAX_SEARCH_WORDS);

export function searchCondition(search: string | undefined): Prisma.Sql {
  const words = searchWords(search);
  if (words.length === 0) return Prisma.sql`TRUE`;
  return Prisma.join(
    words.map((word) =>
      word.length >= MIN_TYPO_LENGTH
        ? Prisma.sql`(p."searchText" ~ ${`\\m${word}`} OR ${word} <% p."searchText")`
        : Prisma.sql`p."searchText" ~ ${`\\m${word}`}`,
    ),
    ' AND ',
  );
}

/** Exécute une recherche avec le seuil de fautes de frappe, le temps de la transaction. */
export async function searchRows<T>(
  prisma: PrismaClient,
  query: Prisma.Sql,
): Promise<T[]> {
  const [, rows] = await prisma.$transaction([
    prisma.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${TYPO_SIMILARITY}, true)`,
    prisma.$queryRaw<T[]>(query),
  ]);
  return rows;
}

@Injectable()
export class ProductService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly identity: IdentityService,
  ) {}

  // Le nom le plus proche du premier mot d'abord : « dracofeu » est plus près
  // de « dracaufeu » (2 lettres) que de « draco » (3), ce que les trigrammes
  // ne distinguent pas.
  async search(
    authorization: string | undefined,
    query: SearchProductsDto,
  ): Promise<ProductDto[]> {
    await this.identity.requireSession(authorization);
    const rows = await searchRows<{ id: string }>(
      this.prisma,
      Prisma.sql`
      SELECT p."id" FROM "Product" p
      WHERE ${searchCondition(query.search)}
        ${query.productType ? Prisma.sql`AND p."productType" = ${query.productType}::"ProductType"` : Prisma.empty}
      ORDER BY levenshtein(${searchWords(query.search)[0] ?? ''}, split_part(p."searchText", ' ', 1)),
        word_similarity(${toSearchText(query.search)}, p."searchText") DESC,
        similarity(${toSearchText(query.search)}, p."searchText") DESC,
        p."name", p."id"
      LIMIT ${query.take} OFFSET ${query.skip}`,
    );
    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map(({ id }) => id) } },
      include: WITH_CARDMARKET,
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return rows.flatMap(({ id }) => {
      const product = byId.get(id);
      return product ? [toProductDto(product)] : [];
    });
  }

  async get(
    authorization: string | undefined,
    id: string,
  ): Promise<ProductDto> {
    await this.identity.requireSession(authorization);
    return toProductDto(await this.getOrThrow(id));
  }

  async getPrice(
    authorization: string | undefined,
    id: string,
  ): Promise<PriceDto> {
    const { price, priceUpdatedAt } = await this.get(authorization, id);
    return { price, priceUpdatedAt };
  }

  // Relevés quotidiens du produit Cardmarket lié ; vide sans lien.
  async priceHistory(
    authorization: string | undefined,
    id: string,
  ): Promise<PricePointDto[]> {
    await this.identity.requireSession(authorization);
    const { cardmarketId } = await this.getOrThrow(id);
    if (cardmarketId === null) return [];
    const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const snapshots = await this.prisma.priceSnapshot.findMany({
      where: { cardmarketId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
    return snapshots.map((snapshot) => ({
      date: snapshot.date.toISOString().slice(0, 10),
      trend: amount(snapshot.trend),
      low: amount(snapshot.low),
    }));
  }

  // Produit absent des sources, ajouté par l'équipe : une création concurrente
  // du même produit renvoie celui qui existe déjà au lieu d'en créer un second.
  async create(
    authorization: string | undefined,
    dto: CreateProductDto,
  ): Promise<ProductDto> {
    await this.identity.requireStaff(authorization, CATALOG_MANAGE);
    const unique = {
      source: ProductSource.MANUAL,
      productType: dto.productType,
      name: dto.name,
      setCode: dto.setCode ?? null,
      cardNumber: dto.cardNumber ?? null,
    };
    try {
      const product = await this.prisma.product.create({
        data: {
          ...unique,
          setName: dto.setName,
          rarity: dto.rarity,
          searchText: toSearchText(
            dto.name,
            dto.setCode,
            dto.setName,
            dto.cardNumber,
          ),
        },
        include: WITH_CARDMARKET,
      });
      return toProductDto(product);
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      return toProductDto(
        await this.prisma.product.findFirstOrThrow({
          where: unique,
          include: WITH_CARDMARKET,
        }),
      );
    }
  }

  // Corrige un lien faux ou absent : le produit Cardmarket est retiré du
  // produit qui le portait, et la synchronisation ne revient plus dessus.
  async linkCardmarket(
    authorization: string | undefined,
    id: string,
    cardmarketId: number | null,
  ): Promise<ProductDto> {
    await this.identity.requireStaff(authorization, CATALOG_MANAGE);
    await this.getOrThrow(id);
    if (cardmarketId !== null) {
      const cardmarket = await this.prisma.cardmarketProduct.findUnique({
        where: { id: cardmarketId },
      });
      if (!cardmarket) {
        throw new NotFoundException('Produit Cardmarket introuvable');
      }
    }
    const [, product] = await this.prisma.$transaction([
      this.prisma.product.updateMany({
        where: { cardmarketId: cardmarketId ?? -1, id: { not: id } },
        data: { cardmarketId: null },
      }),
      this.prisma.product.update({
        where: { id },
        data: { cardmarketId, cardmarketLinkedByUser: true },
        include: WITH_CARDMARKET,
      }),
    ]);
    return toProductDto(product);
  }

  async getOrThrow(id: string): Promise<ProductWithCardmarket> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: WITH_CARDMARKET,
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }
}
