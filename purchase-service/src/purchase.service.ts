import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { allocateCosts, checkFixedCosts } from './allocation';
import {
  Prisma,
  PrismaClient,
  type Purchase,
  type PurchaseLine,
} from './generated/prisma/client';
import { IdentityService, PURCHASE_MANAGE } from './identity.service';
import { InventoryItem, InventoryService } from './inventory.service';
import {
  CreatePurchaseDto,
  ListPurchasesDto,
  PurchaseDetailDto,
  PurchaseDto,
  PurchaseLineDto,
  PurchaseLineInputDto,
  PurchasedItemDto,
  PurchasesSummaryDto,
} from './purchase.dto';

// Chaque exemplaire est créé par un appel à inventory.
export const MAX_ITEMS = 100;

const toCents = (amount: number | string): bigint =>
  BigInt(new Prisma.Decimal(amount).times(100).toFixed(0));

const fromCents = (cents: bigint) =>
  new Prisma.Decimal(cents.toString()).div(100);

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

interface Totals {
  itemCount: number;
  marketValue: Prisma.Decimal;
}

const toDto = (purchase: Purchase, totals: Totals): PurchaseDto => ({
  id: purchase.id,
  supplier: purchase.supplier,
  purchasedAt: isoDate(purchase.purchasedAt),
  price: purchase.price.toFixed(2),
  fees: purchase.fees.toFixed(2),
  totalCost: purchase.price.plus(purchase.fees).toFixed(2),
  marketValue: totals.marketValue.toFixed(2),
  itemCount: totals.itemCount,
  notes: purchase.notes,
  createdAt: purchase.createdAt,
});

const toLineDto = (line: PurchaseLine): PurchaseLineDto => ({
  id: line.id,
  inventoryItemId: line.inventoryItemId,
  productId: line.productId,
  productName: line.productName,
  productType: line.productType,
  setCode: line.setCode,
  setName: line.setName,
  cardNumber: line.cardNumber,
  imageUrl: line.imageUrl,
  condition: line.condition,
  language: line.language,
  gradingCompany: line.gradingCompany,
  grade: line.grade?.toNumber() ?? null,
  reverse: line.reverse,
  marketPrice: line.marketPrice?.toFixed(2) ?? null,
  cost: line.cost.toFixed(2),
});

const toDetailDto = (
  purchase: Purchase & { lines: PurchaseLine[] },
): PurchaseDetailDto => ({
  ...toDto(purchase, {
    itemCount: purchase.lines.length,
    marketValue: purchase.lines.reduce(
      (total, line) => total.plus(line.marketPrice ?? 0),
      new Prisma.Decimal(0),
    ),
  }),
  lines: purchase.lines.map(toLineDto),
});

const WITH_LINES = { lines: { orderBy: { position: 'asc' } } } as const;

// Une ligne saisie de N unités devient N exemplaires, chacun avec son coût.
const expandUnits = (lines: PurchaseLineInputDto[]) =>
  lines.flatMap(({ quantity, unitCost, ...item }) =>
    Array.from({ length: quantity }, () => ({
      item,
      cost: unitCost === undefined ? undefined : toCents(unitCost),
    })),
  );

// Chaque requête filtre sur `organizationId` : une organisation ne voit ni ne
// modifie jamais les achats d'une autre, même avec l'id d'un de ses achats.
@Injectable()
export class PurchaseService {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly identity: IdentityService,
    private readonly inventory: InventoryService,
  ) {}

  async list(
    authorization: string | undefined,
    organizationId: string,
    query: ListPurchasesDto,
  ): Promise<PurchaseDto[]> {
    await this.identity.getPermissions(authorization, organizationId);
    const purchases = await this.prisma.purchase.findMany({
      where: { organizationId },
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.take,
      skip: query.skip,
    });
    const totals = await this.prisma.purchaseLine.groupBy({
      by: ['purchaseId'],
      where: { purchaseId: { in: purchases.map(({ id }) => id) } },
      _count: { _all: true },
      _sum: { marketPrice: true },
    });
    return purchases.map((purchase) => {
      const total = totals.find(({ purchaseId }) => purchaseId === purchase.id);
      return toDto(purchase, {
        itemCount: total?._count._all ?? 0,
        marketValue: total?._sum.marketPrice ?? new Prisma.Decimal(0),
      });
    });
  }

  // Calculé en base : la liste est paginée, un total côté client serait faux.
  async summary(
    authorization: string | undefined,
    organizationId: string,
  ): Promise<PurchasesSummaryDto> {
    await this.identity.getPermissions(authorization, organizationId);
    const [purchases, itemCount] = await Promise.all([
      this.prisma.purchase.aggregate({
        where: { organizationId },
        _count: { _all: true },
        _sum: { price: true, fees: true },
      }),
      this.prisma.purchaseLine.count({
        where: { purchase: { organizationId } },
      }),
    ]);
    const { price, fees } = purchases._sum;
    return {
      purchaseCount: purchases._count._all,
      itemCount,
      totalCost: (price ?? new Prisma.Decimal(0)).plus(fees ?? 0).toFixed(2),
    };
  }

  async get(
    authorization: string | undefined,
    organizationId: string,
    id: string,
  ): Promise<PurchaseDetailDto> {
    await this.identity.getPermissions(authorization, organizationId);
    return toDetailDto(await this.findOrThrow(organizationId, id));
  }

  async getItem(
    authorization: string | undefined,
    organizationId: string,
    inventoryItemId: string,
  ): Promise<PurchasedItemDto> {
    await this.identity.getPermissions(authorization, organizationId);
    const line = await this.prisma.purchaseLine.findFirst({
      where: { inventoryItemId, purchase: { organizationId } },
      include: { purchase: true },
    });
    if (!line) throw new NotFoundException('Exemplaire sans achat');
    return {
      purchaseId: line.purchaseId,
      supplier: line.purchase.supplier,
      purchasedAt: isoDate(line.purchase.purchasedAt),
      cost: line.cost.toFixed(2),
    };
  }

  // Les exemplaires entrent au stock d'abord : leur Price Trend fixe la
  // répartition. Si une étape échoue, ceux déjà créés en sont retirés.
  async create(
    authorization: string | undefined,
    organizationId: string,
    dto: CreatePurchaseDto,
  ): Promise<PurchaseDetailDto> {
    await this.identity.requirePermission(
      authorization,
      organizationId,
      PURCHASE_MANAGE,
    );
    const units = expandUnits(dto.lines);
    if (units.length > MAX_ITEMS) {
      throw new BadRequestException(
        `Un achat compte ${MAX_ITEMS} exemplaires au plus`,
      );
    }
    const total = toCents(dto.price) + toCents(dto.fees);
    checkFixedCosts(
      total,
      units.map(({ cost }) => cost),
    );

    const items: InventoryItem[] = [];
    try {
      for (const { item } of units) {
        items.push(
          await this.inventory.addItem(authorization!, organizationId, item),
        );
      }
      const costs = allocateCosts(
        total,
        units.map(({ cost }, index) => ({
          cost,
          marketPrice: items[index].price ? toCents(items[index].price) : null,
        })),
      );
      const purchase = await this.prisma.purchase.create({
        data: {
          organizationId,
          supplier: dto.supplier,
          purchasedAt: new Date(dto.purchasedAt),
          price: dto.price,
          fees: dto.fees,
          notes: dto.notes || null,
          lines: {
            create: items.map((item, position) => ({
              position,
              inventoryItemId: item.id,
              productId: item.product.id,
              productName: item.product.name,
              productType: item.product.productType,
              setCode: item.product.setCode,
              setName: item.product.setName,
              cardNumber: item.product.cardNumber,
              imageUrl: item.product.imageUrl,
              condition: item.condition,
              language: item.language,
              gradingCompany: item.gradingCompany,
              grade: item.grade,
              reverse: item.reverse,
              marketPrice: item.price,
              cost: fromCents(costs[position]),
            })),
          },
        },
        include: WITH_LINES,
      });
      return toDetailDto(purchase);
    } catch (error) {
      await Promise.allSettled(
        items.map(({ id }) =>
          this.inventory.removeItem(authorization!, organizationId, id),
        ),
      );
      throw error;
    }
  }

  // Supprimer un achat le retire du stock : c'est corriger une saisie. Un
  // échec en cours de route laisse l'achat, qu'on peut supprimer de nouveau.
  async remove(
    authorization: string | undefined,
    organizationId: string,
    id: string,
  ): Promise<void> {
    await this.identity.requirePermission(
      authorization,
      organizationId,
      PURCHASE_MANAGE,
    );
    const purchase = await this.findOrThrow(organizationId, id);
    for (const line of purchase.lines) {
      await this.inventory.removeItem(
        authorization!,
        organizationId,
        line.inventoryItemId,
      );
    }
    await this.prisma.purchase.deleteMany({ where: { id, organizationId } });
  }

  private async findOrThrow(organizationId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, organizationId },
      include: WITH_LINES,
    });
    if (!purchase) throw new NotFoundException('Achat introuvable');
    return purchase;
  }
}
