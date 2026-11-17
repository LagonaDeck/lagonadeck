import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PickedItem,
  Purchase,
  PurchaseDetail,
  PurchaseDraftLine,
  PurchasedItem,
  PurchasesSummary,
  StockSummary,
} from '../models/purchase';
import { OrganizationService } from './organization.service';

// Maximum accepté par l'API pour une page.
const PAGE_SIZE = 100;

/**
 * Achats de l'organisation courante. Les méthodes qui renvoient une ressource
 * s'appellent à la construction du component, qui la détruit avec lui.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly http = inject(HttpClient);
  private readonly organizations = inject(OrganizationService);
  // Même maximum que l'API : chaque unité devient un exemplaire du stock.
  readonly maxItems = 100;

  private readonly base = this.organizations.currentUrl('purchases');

  canManage() {
    return this.organizations.can('PURCHASE_MANAGE');
  }

  list(page: () => number) {
    return httpResource<Purchase[]>(() => {
      const base = this.base();
      return base
        ? {
            url: base,
            params: { take: PAGE_SIZE, skip: page() * PAGE_SIZE },
          }
        : undefined;
    });
  }

  hasNextPage(purchases: Purchase[]): boolean {
    return purchases.length === PAGE_SIZE;
  }

  // `from` limite le résumé aux achats datés à partir de ce jour.
  summary(from: () => string | undefined = () => undefined) {
    return httpResource<PurchasesSummary>(() => {
      const base = this.base();
      const start = from();
      return base
        ? `${base}/summary${start ? `?from=${start}` : ''}`
        : undefined;
    });
  }

  stockSummary() {
    return httpResource<StockSummary>(() => {
      const base = this.base();
      return base ? `${base}/stock-summary` : undefined;
    });
  }

  detail(purchaseId: () => string) {
    return httpResource<PurchaseDetail>(() => {
      const base = this.base();
      return base ? `${base}/${purchaseId()}` : undefined;
    });
  }

  // Un exemplaire ajouté hors d'un achat n'en a pas : la réponse est un 404.
  purchasedItem(inventoryItemId: () => string) {
    return httpResource<PurchasedItem>(() => {
      const base = this.base();
      return base ? `${base}/items/${inventoryItemId()}` : undefined;
    });
  }

  create(
    form: Record<string, string>,
    lines: PurchaseDraftLine[],
  ): Observable<PurchaseDetail> {
    const base = this.base();
    if (!base) return this.organizations.noCurrent();
    const { supplier, purchasedAt, price, fees, notes } = form;
    return this.http.post<PurchaseDetail>(base, {
      supplier,
      purchasedAt,
      price: Number(price),
      fees: Number(fees || 0),
      ...(notes && { notes }),
      lines: lines.map(({ item, quantity, unitCost }) => ({
        productId: item.product.id,
        condition: item.condition,
        language: item.language,
        gradingCompany: item.gradingCompany,
        grade: item.grade,
        reverse: item.reverse,
        quantity,
        ...(unitCost !== null && { unitCost }),
      })),
    });
  }

  delete(purchaseId: string): Observable<void> {
    const base = this.base();
    if (!base) return this.organizations.noCurrent();
    return this.http.delete<void>(`${base}/${purchaseId}`);
  }

  // Prix de l'exemplaire tel que le stock le valorisera : celui de la reverse
  // pour une reverse, aucun pour une carte gradée.
  unitPrice({ product, reverse, gradingCompany }: PickedItem): number | null {
    if (gradingCompany) return null;
    const price = reverse ? product.cardmarket?.trendHolo : product.price;
    return price && Number(price) > 0 ? Number(price) : null;
  }

  itemCount(lines: PurchaseDraftLine[]): number {
    return lines.reduce((count, line) => count + line.quantity, 0);
  }

  marketValue(lines: PurchaseDraftLine[]): number {
    return lines.reduce(
      (total, line) => total + (this.unitPrice(line.item) ?? 0) * line.quantity,
      0,
    );
  }
}
