import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  type InventoryItem,
  type Product,
} from './generated/prisma/client';
import { ProductType } from './generated/prisma/enums';
import { INVENTORY_MANAGE, IdentityService } from './identity.service';
import {
  AddInventoryItemDto,
  InventoryItemDto,
  InventorySummaryDto,
  ListInventoryDto,
} from './inventory.dto';
import {
  ProductService,
  ProductWithCardmarket,
  searchCondition,
  searchRows,
  toProductDto,
} from './product.service';

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

// Une carte à l'unité est brute, avec son état, ou gradée, avec une société et
// une note qui remplacent l'état. Un produit scellé ne se grade pas ici.
function checkCardState(product: Product, dto: AddInventoryItemDto): void {
  const graded = dto.gradingCompany !== undefined || dto.grade !== undefined;
  const single = product.productType === ProductType.SINGLE;
  if (graded && !single) {
    throw new BadRequestException('Seule une carte à l’unité peut être gradée');
  }
  if (graded && (dto.gradingCompany === undefined || dto.grade === undefined)) {
    throw new BadRequestException(
      'Une carte gradée demande une société et une note',
    );
  }
  if (graded && dto.condition !== undefined) {
    throw new BadRequestException(
      'Une carte gradée n’a pas d’état : sa note le remplace',
    );
  }
  if (single && !graded && dto.condition === undefined) {
    throw new BadRequestException(
      'Précisez l’état de la carte, ou sa société et sa note si elle est gradée',
    );
  }
  if (dto.reverse && (!single || product.hasReverse === false)) {
    throw new BadRequestException('Ce produit n’existe pas en reverse');
  }
}

// Cardmarket donne le prix de la reverse dans le produit de la carte, 0 sans
// vente. Le Price Trend vaut pour une carte brute : une gradée n'a pas de prix.
function unitPrice(item: InventoryItem & { product: ProductWithCardmarket }) {
  const cardmarket = item.product.cardmarketProduct;
  if (!cardmarket || item.gradingCompany !== null) return null;
  const price = item.reverse ? cardmarket.trendHolo : cardmarket.trend;
  return price?.greaterThan(0) ? price.toFixed(2) : null;
}

const WITH_PRODUCT = { product: { include: { cardmarketProduct: true } } };

const toDto = (
  item: InventoryItem & { product: ProductWithCardmarket },
): InventoryItemDto => ({
  id: item.id,
  condition: item.condition,
  language: item.language,
  gradingCompany: item.gradingCompany,
  grade: item.grade?.toNumber() ?? null,
  reverse: item.reverse,
  price: unitPrice(item),
  product: toProductDto(item.product),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

// Chaque requête filtre sur `organizationId` : une organisation ne voit ni ne
// modifie jamais le stock d'une autre, même avec l'id d'une de ses lignes.
@Injectable()
export class InventoryService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly identity: IdentityService,
    private readonly productService: ProductService,
  ) {}

  async list(
    authorization: string | undefined,
    organizationId: string,
    query: ListInventoryDto,
  ): Promise<InventoryItemDto[]> {
    await this.identity.getPermissions(authorization, organizationId);
    const matches = query.search
      ? await searchRows<{ id: string }>(
          this.prisma,
          Prisma.sql`
            SELECT i."id" FROM "InventoryItem" i
            JOIN "Product" p ON p."id" = i."productId"
            WHERE i."organizationId" = ${organizationId}::uuid
              AND ${searchCondition(query.search)}`,
        )
      : undefined;
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        organizationId,
        id: matches && { in: matches.map(({ id }) => id) },
      },
      include: WITH_PRODUCT,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: query.take,
      skip: query.skip,
    });
    return items.map(toDto);
  }

  async get(
    authorization: string | undefined,
    organizationId: string,
    id: string,
  ): Promise<InventoryItemDto> {
    await this.identity.getPermissions(authorization, organizationId);
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, organizationId },
      include: WITH_PRODUCT,
    });
    if (!item) throw new NotFoundException('Ligne d’inventaire introuvable');
    return toDto(item);
  }

  // Calculé en base : la liste est paginée, un total côté client serait faux.
  async summary(
    authorization: string | undefined,
    organizationId: string,
  ): Promise<InventorySummaryDto> {
    await this.identity.getPermissions(authorization, organizationId);
    const [summary] = await this.prisma.$queryRaw<
      { itemCount: number; value: Prisma.Decimal; unpricedItemCount: number }[]
    >`
      SELECT
        count(*)::int AS "itemCount",
        coalesce(sum(l."price"), 0) AS "value",
        (count(*) FILTER (WHERE l."price" IS NULL))::int AS "unpricedItemCount"
      FROM "InventoryItem" i
      JOIN "Product" p ON p."id" = i."productId"
      LEFT JOIN "CardmarketProduct" c ON c."id" = p."cardmarketId"
      -- Même règle que unitPrice.
      CROSS JOIN LATERAL (
        SELECT CASE WHEN i."gradingCompany" IS NULL
          THEN nullif(CASE WHEN i."reverse" THEN c."trendHolo" ELSE c."trend" END, 0)
        END AS "price"
      ) l
      WHERE i."organizationId" = ${organizationId}::uuid`;
    return { ...summary, value: summary.value.toFixed(2) };
  }

  async add(
    authorization: string | undefined,
    organizationId: string,
    dto: AddInventoryItemDto,
  ): Promise<InventoryItemDto> {
    await this.identity.requirePermission(
      authorization,
      organizationId,
      INVENTORY_MANAGE,
    );
    const product = await this.productService.getOrThrow(dto.productId);
    checkCardState(product, dto);
    const item = await this.prisma.inventoryItem.create({
      data: {
        organizationId,
        productId: product.id,
        condition: dto.condition,
        language: dto.language,
        gradingCompany: dto.gradingCompany,
        grade: dto.grade,
        reverse: dto.reverse,
      },
    });
    return toDto({ ...item, product });
  }

  async remove(
    authorization: string | undefined,
    organizationId: string,
    id: string,
  ): Promise<void> {
    await this.identity.requirePermission(
      authorization,
      organizationId,
      INVENTORY_MANAGE,
    );
    try {
      await this.prisma.inventoryItem.delete({ where: { id, organizationId } });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Ligne d’inventaire introuvable');
      }
      throw error;
    }
  }
}
