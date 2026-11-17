import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  CardmarketPrices,
  PriceDirection,
  PricePoint,
  Product,
} from '../models/product';
import { Report } from '../models/report';

const MIN_QUERY_LENGTH = 2;

// Écart entre les moyennes 7 et 30 jours en dessous duquel le prix est stable.
const STABLE_RATIO = 0.02;

/**
 * Catalogue partagé par toutes les organisations. Les méthodes qui renvoient
 * une ressource s'appellent à la construction du component, qui la détruit
 * avec lui.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  readonly minQueryLength = MIN_QUERY_LENGTH;

  search(query: () => string, productType: () => string) {
    return httpResource<Product[]>(() =>
      query().length >= MIN_QUERY_LENGTH
        ? {
            url: '/api/products',
            params: {
              search: query(),
              ...(productType() && { productType: productType() }),
            },
          }
        : undefined,
    );
  }

  priceHistory(product: () => Product | undefined) {
    return httpResource<PricePoint[]>(() => {
      const current = product();
      return current?.cardmarket
        ? `/api/products/${current.id}/price-history`
        : undefined;
    });
  }

  // Les champs facultatifs laissés vides ne sont pas envoyés.
  createProduct(form: object) {
    const values = Object.entries(form).filter(([, value]) => value !== '');
    return this.http.post<Product>('/api/products', Object.fromEntries(values));
  }

  report(report: object) {
    return this.http.post('/api/products/reports', report);
  }

  reports(status: () => Report['status']) {
    return httpResource<Report[]>(() => ({
      url: '/api/products/reports',
      params: { status: status() },
    }));
  }

  setReportStatus(reportId: string, status: Report['status']) {
    return this.http.patch(`/api/products/reports/${reportId}`, { status });
  }

  linkCardmarket(productId: string, cardmarketId: number | null) {
    return this.http.put(`/api/products/${productId}/cardmarket`, {
      cardmarketId,
    });
  }

  // La moyenne 7 jours comparée à la moyenne 30 jours, comme sur Cardmarket.
  priceDirection(cardmarket: CardmarketPrices): PriceDirection | null {
    if (!cardmarket.avg7 || !cardmarket.avg30) return null;
    const change = Number(cardmarket.avg7) / Number(cardmarket.avg30) - 1;
    if (change > STABLE_RATIO) return 'up';
    if (change < -STABLE_RATIO) return 'down';
    return 'stable';
  }
}
