import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { allocate, checkFixedPrices } from './allocation';
import {
  Prisma,
  PrismaClient,
  type Sale,
  type SaleLine,
} from './generated/prisma/client';
import { IdentityService, SALE_MANAGE } from './identity.service';
import { InventoryService, type InventoryItem } from './inventory.service';
import { PurchaseService } from './purchase.service';
import {
  CreateSaleDto,
  ListSalesDto,
  SaleDetailDto,
  SaleDto,
  SaleLineDto,
  SalesSummaryDto,
  SalesSummaryQueryDto,
} from './sale.dto';

const ZERO = new Prisma.Decimal(0);

const toCents = (amount: number | string): bigint =>
  BigInt(new Prisma.Decimal(amount).times(100).toFixed(0));

const fromCents = (cents: bigint) =>
  new Prisma.Decimal(cents.toString()).div(100);

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

// Un refus d'inventory (4xx) vaut pour tout le lot : rien n'est sorti du stock.
const rejectedByInventory = (error: unknown) =>
  error instanceof HttpException && error.getStatus() < 500;

// La marge ne compte que les exemplaires au coût connu : un exemplaire entré
// au stock sans achat la gonflerait de tout son prix.
interface Totals {
  itemCount: number;
  costedItemCount: number;
  costedPrice: Prisma.Decimal;
  costedFees: Prisma.Decimal;
  cost: Prisma.Decimal;
}

const marginOf = (totals: Totals) =>
  totals.costedPrice.minus(totals.costedFees).minus(totals.cost);

const toDto = (sale: Sale, totals: Totals): SaleDto => ({
  id: sale.id,
  buyer: sale.buyer,
  soldAt: isoDate(sale.soldAt),
  price: sale.price.toFixed(2),
  fees: sale.fees.toFixed(2),
  revenue: sale.price.minus(sale.fees).toFixed(2),
  cost: totals.cost.toFixed(2),
  margin: marginOf(totals).toFixed(2),
  itemCount: totals.itemCount,
  uncostedItemCount: totals.itemCount - totals.costedItemCount,
  notes: sale.notes,
  createdAt: sale.createdAt,
});

const toLineDto = (line: SaleLine): SaleLineDto => ({
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
  price: line.price.toFixed(2),
  fees: line.fees.toFixed(2),
  cost: line.cost?.toFixed(2) ?? null,
  margin: line.cost
    ? line.price.minus(line.fees).minus(line.cost).toFixed(2)
    : null,
});

const totalsOf = (lines: SaleLine[]): Totals => {
  const costed = lines.filter(({ cost }) => cost !== null);
  const total = (amounts: Prisma.Decimal[]) =>
    amounts.reduce((sum, amount) => sum.plus(amount), ZERO);
  return {
    itemCount: lines.length,
    costedItemCount: costed.length,
    costedPrice: total(costed.map(({ price }) => price)),
    costedFees: total(costed.map(({ fees }) => fees)),
    cost: total(costed.map(({ cost }) => cost!)),
  };
};

const toDetailDto = (sale: Sale & { lines: SaleLine[] }): SaleDetailDto => ({
  ...toDto(sale, totalsOf(sale.lines)),
  lines: sale.lines.map(toLineDto),
});

const lineFromItem = (item: InventoryItem) => ({
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
});

const WITH_LINES = { lines: { orderBy: { position: 'asc' } } } as const;

// Remis au stock tel qu'il en était sorti, avec son id d'origine.
const toInventoryItem = (line: SaleLine) => ({
  id: line.inventoryItemId,
  productId: line.productId,
  condition: line.condition ?? undefined,
  language: line.language ?? undefined,
  gradingCompany: line.gradingCompany ?? undefined,
  grade: line.grade?.toNumber(),
  reverse: line.reverse,
});

// Chaque requête filtre sur `organizationId` : une organisation ne voit ni ne
// modifie jamais les ventes d'une autre, même avec l'id d'une de ses ventes.
@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name);

  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    private readonly identity: IdentityService,
    private readonly inventory: InventoryService,
    private readonly purchase: PurchaseService,
  ) {}

  async list(
    userId: string,
    organizationId: string,
    query: ListSalesDto,
  ): Promise<SaleDto[]> {
    await this.identity.getPermissions(userId, organizationId);
    const sales = await this.prisma.sale.findMany({
      where: { organizationId },
      orderBy: [{ soldAt: 'desc' }, { createdAt: 'desc' }],
      take: query.take,
      skip: query.skip,
    });
    const saleIds = sales.map(({ id }) => id);
    const [counts, costed] = await Promise.all([
      this.prisma.saleLine.groupBy({
        by: ['saleId'],
        where: { saleId: { in: saleIds } },
        _count: { _all: true },
      }),
      this.prisma.saleLine.groupBy({
        by: ['saleId'],
        where: { saleId: { in: saleIds }, cost: { not: null } },
        _count: { _all: true },
        _sum: { price: true, fees: true, cost: true },
      }),
    ]);
    return sales.map((sale) => {
      const count = counts.find(({ saleId }) => saleId === sale.id);
      const sums = costed.find(({ saleId }) => saleId === sale.id);
      return toDto(sale, {
        itemCount: count?._count._all ?? 0,
        costedItemCount: sums?._count._all ?? 0,
        costedPrice: sums?._sum.price ?? ZERO,
        costedFees: sums?._sum.fees ?? ZERO,
        cost: sums?._sum.cost ?? ZERO,
      });
    });
  }

  // Calculé en base : la liste est paginée, un total côté client serait faux.
  async summary(
    userId: string,
    organizationId: string,
    query: SalesSummaryQueryDto,
  ): Promise<SalesSummaryDto> {
    await this.identity.getPermissions(userId, organizationId);
    const where = {
      organizationId,
      soldAt: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
    };
    const [sales, itemCount, costed] = await Promise.all([
      this.prisma.sale.aggregate({
        where,
        _count: { _all: true },
        _sum: { price: true, fees: true },
      }),
      this.prisma.saleLine.count({ where: { sale: where } }),
      this.prisma.saleLine.aggregate({
        where: { sale: where, cost: { not: null } },
        _count: { _all: true },
        _sum: { price: true, fees: true, cost: true },
      }),
    ]);
    const totals: Totals = {
      itemCount,
      costedItemCount: costed._count._all,
      costedPrice: costed._sum.price ?? ZERO,
      costedFees: costed._sum.fees ?? ZERO,
      cost: costed._sum.cost ?? ZERO,
    };
    return {
      saleCount: sales._count._all,
      itemCount,
      revenue: (sales._sum.price ?? ZERO)
        .minus(sales._sum.fees ?? 0)
        .toFixed(2),
      cost: totals.cost.toFixed(2),
      margin: marginOf(totals).toFixed(2),
      uncostedItemCount: itemCount - totals.costedItemCount,
    };
  }

  async get(
    userId: string,
    organizationId: string,
    id: string,
  ): Promise<SaleDetailDto> {
    await this.identity.getPermissions(userId, organizationId);
    return toDetailDto(await this.findOrThrow(organizationId, id));
  }

  // La vente est enregistrée avant la sortie du stock : l'unicité de
  // l'exemplaire dans les ventes empêche de vendre deux fois le même.
  async create(
    userId: string,
    organizationId: string,
    dto: CreateSaleDto,
  ): Promise<SaleDetailDto> {
    await this.identity.requirePermission(userId, organizationId, SALE_MANAGE);
    const price = toCents(dto.price);
    const fixedPrices = dto.lines.map(({ unitPrice }) =>
      unitPrice === undefined ? undefined : toCents(unitPrice),
    );
    checkFixedPrices(price, fixedPrices);

    const ids = dto.lines.map(({ inventoryItemId }) => inventoryItemId);
    const [items, purchased] = await Promise.all([
      this.inventory.findItems(userId, organizationId, ids),
      this.purchase.findItems(userId, organizationId, ids),
    ]);
    if (items.length !== ids.length) {
      throw new NotFoundException('Exemplaire absent du stock');
    }
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered = ids.map((id) => byId.get(id)!);
    const costs = new Map(
      purchased.map(({ inventoryItemId, cost }) => [inventoryItemId, cost]),
    );
    const prices = allocate(
      price,
      ordered.map((item, index) => ({
        amount: fixedPrices[index],
        weight: item.price ? toCents(item.price) : null,
      })),
    );
    const fees = allocate(
      toCents(dto.fees),
      prices.map((weight) => ({ weight })),
    );

    const sale = await this.save(
      organizationId,
      dto,
      ordered.map((item, position) => ({
        ...lineFromItem(item),
        position,
        price: fromCents(prices[position]),
        fees: fromCents(fees[position]),
        cost: costs.get(item.id) ?? null,
      })),
    );
    await this.takeOutOfStock(userId, organizationId, sale.id, ids);
    return toDetailDto(sale);
  }

  // Supprimer une vente remet ses exemplaires au stock : c'est corriger une
  // saisie, ou enregistrer un retour. Ceux déjà remis par un essai précédent
  // sont laissés : la suppression peut être rejouée.
  async remove(
    userId: string,
    organizationId: string,
    id: string,
  ): Promise<void> {
    await this.identity.requirePermission(userId, organizationId, SALE_MANAGE);
    const sale = await this.findOrThrow(organizationId, id);
    const inStock = await this.inventory.findItems(
      userId,
      organizationId,
      sale.lines.map(({ inventoryItemId }) => inventoryItemId),
    );
    const returned = new Set(inStock.map(({ id }) => id));
    const missing = sale.lines.filter(
      ({ inventoryItemId }) => !returned.has(inventoryItemId),
    );
    if (missing.length > 0) {
      await this.inventory.addItems(
        userId,
        organizationId,
        missing.map(toInventoryItem),
      );
    }
    await this.prisma.sale.deleteMany({ where: { id, organizationId } });
  }

  private async save(
    organizationId: string,
    dto: CreateSaleDto,
    lines: Prisma.SaleLineCreateWithoutSaleInput[],
  ) {
    try {
      return await this.prisma.sale.create({
        data: {
          organizationId,
          buyer: dto.buyer,
          soldAt: new Date(dto.soldAt),
          price: dto.price,
          fees: dto.fees,
          notes: dto.notes || null,
          lines: { create: lines },
        },
        include: WITH_LINES,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException('Exemplaire déjà vendu');
      }
      throw error;
    }
  }

  // Si la sortie du stock échoue, la vente est annulée. Sans réponse
  // d'inventory, les exemplaires sont peut-être sortis quand même : le log
  // garde leurs ids pour les remettre à la main.
  private async takeOutOfStock(
    userId: string,
    organizationId: string,
    saleId: string,
    ids: string[],
  ): Promise<void> {
    try {
      await this.inventory.removeItems(userId, organizationId, ids);
    } catch (error) {
      await this.prisma.sale.deleteMany({ where: { id: saleId } });
      if (!rejectedByInventory(error)) {
        this.logger.error(
          `Vente annulée, exemplaires peut-être sortis du stock (organisation ${organizationId}) : ${ids.join(', ')}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      throw error;
    }
  }

  private async findOrThrow(organizationId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId },
      include: WITH_LINES,
    });
    if (!sale) throw new NotFoundException('Vente introuvable');
    return sale;
  }
}
