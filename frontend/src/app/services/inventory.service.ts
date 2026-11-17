import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  InventoryItem,
  InventorySummary,
  NewInventoryItem,
} from '../models/inventory-item';
import { OrganizationService } from './organization.service';

// Maximum accepté par l'API pour une page.
const PAGE_SIZE = 100;

/**
 * Stock de l'organisation courante. Les méthodes qui renvoient une ressource
 * s'appellent à la construction du component, qui la détruit avec lui.
 */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly organizations = inject(OrganizationService);

  private readonly base = this.organizations.currentUrl('inventory');

  canManage() {
    return this.organizations.can('INVENTORY_MANAGE');
  }

  list(page: () => number, search: () => string) {
    return httpResource<InventoryItem[]>(() => {
      const base = this.base();
      return base
        ? {
            url: base,
            params: {
              take: PAGE_SIZE,
              skip: page() * PAGE_SIZE,
              ...(search() && { search: search() }),
            },
          }
        : undefined;
    });
  }

  hasNextPage(items: InventoryItem[]): boolean {
    return items.length === PAGE_SIZE;
  }

  summary() {
    return httpResource<InventorySummary>(() => {
      const base = this.base();
      return base ? `${base}/summary` : undefined;
    });
  }

  item(itemId: () => string) {
    return httpResource<InventoryItem>(() => {
      const base = this.base();
      return base ? `${base}/${itemId()}` : undefined;
    });
  }

  itemFromForm(form: Record<string, string | undefined>): NewInventoryItem {
    const { condition, language, gradingCompany, grade, reverse } = form;
    return {
      ...(condition && { condition }),
      ...(language && { language }),
      ...(gradingCompany && { gradingCompany, grade: Number(grade) }),
      ...(reverse && { reverse: true }),
    };
  }

  add(productId: string, item: NewInventoryItem): Observable<unknown> {
    const base = this.base();
    if (!base) return this.organizations.noCurrent();
    return this.http.post(base, { productId, ...item });
  }

  remove(itemId: string): Observable<unknown> {
    const base = this.base();
    if (!base) return this.organizations.noCurrent();
    return this.http.delete(`${base}/${itemId}`);
  }
}
