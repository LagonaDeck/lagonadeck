import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideEye,
  LucidePlus,
} from '@lucide/angular';
import { RouterLink } from '@angular/router';
import { PRODUCT_TYPES, formatPrice } from './catalog';
import { Organizations } from './organizations';

export interface Purchase {
  id: string;
  supplier: string;
  purchasedAt: string;
  price: string;
  fees: string;
  /** Prix et frais : la somme des coûts des exemplaires. */
  totalCost: string;
  /** Price Trend des exemplaires le jour de l'achat, sans ceux sans prix. */
  marketValue: string;
  itemCount: number;
  notes: string | null;
  createdAt: string;
}

/** Un exemplaire acheté, copié depuis le stock au moment de l'achat. */
export interface PurchaseLine {
  id: string;
  inventoryItemId: string;
  /** Faux quand l'exemplaire a été retiré du stock depuis l'achat. */
  inStock: boolean;
  productId: string;
  productName: string;
  productType: string;
  setCode: string | null;
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
  condition: string | null;
  language: string | null;
  gradingCompany: string | null;
  grade: number | null;
  reverse: boolean;
  marketPrice: string | null;
  cost: string;
}

export interface PurchaseDetail extends Purchase {
  lines: PurchaseLine[];
}

interface PurchasesSummary {
  purchaseCount: number;
  itemCount: number;
  totalCost: string;
}

/** Achat et coût d'un exemplaire du stock. */
export interface PurchasedItem {
  purchaseId: string;
  supplier: string;
  purchasedAt: string;
  cost: string;
}

// L'API renvoie une date sans heure : la lire en UTC garde le bon jour.
export const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString('fr-CH', { timeZone: 'UTC' });

/** « 151 - Cartes » : le set et le type du produit acheté. */
export const lineDetails = (line: PurchaseLine): string =>
  [line.setName, PRODUCT_TYPES[line.productType]].filter(Boolean).join(' - ');

// Maximum accepté par l'API pour une page.
const PAGE_SIZE = 100;

@Component({
  selector: 'app-purchases',
  imports: [
    LucideChevronLeft,
    LucideChevronRight,
    LucideEye,
    LucidePlus,
    RouterLink,
  ],
  template: `
    <div class="page-header">
      <h1>Achats</h1>
      @if (canManage()) {
        <a class="small-button" routerLink="new">
          <svg lucidePlus [size]="16" aria-hidden="true"></svg>
          Nouvel achat
        </a>
      }
    </div>

    <dl class="summary">
      <div>
        <dt>Valeur totale des achats</dt>
        <dd>{{ formatPrice(totals().totalCost) }}</dd>
      </div>
      <div>
        <dt>Nombre d’achats</dt>
        <dd>{{ count(totals().purchaseCount) }}</dd>
      </div>
    </dl>

    <div class="table">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Fournisseur</th>
            <th scope="col" class="number">Exemplaires</th>
            <th scope="col" class="number">Valeur à l’achat</th>
            <th scope="col" class="number">Coût</th>
            <th scope="col"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (purchase of list(); track purchase.id) {
            <tr>
              <td>{{ formatDate(purchase.purchasedAt) }}</td>
              <td>{{ purchase.supplier }}</td>
              <td class="number">{{ purchase.itemCount }}</td>
              <td
                class="number"
                title="Price Trend Cardmarket des exemplaires le jour de l’achat"
              >
                {{ formatPrice(purchase.marketValue) }}
              </td>
              <td class="number" title="Prix et frais">
                {{ formatPrice(purchase.totalCost) }}
              </td>
              <td>
                <a
                  class="small-button"
                  [routerLink]="purchase.id"
                  [attr.aria-label]="
                    'Voir l’achat ' +
                    purchase.supplier +
                    ' du ' +
                    formatDate(purchase.purchasedAt)
                  "
                >
                  <svg lucideEye [size]="16" aria-hidden="true"></svg>
                  Voir
                </a>
              </td>
            </tr>
          } @empty {
            <tr>
              <td class="empty" colspan="6">
                @if (purchases.isLoading()) {
                  Chargement…
                } @else {
                  Aucun achat trouvé.
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (page() > 0 || hasNextPage()) {
      <nav class="pagination" aria-label="Pages des achats">
        <button
          type="button"
          class="icon-button"
          aria-label="Page précédente"
          [disabled]="page() === 0"
          (click)="page.set(page() - 1)"
        >
          <svg lucideChevronLeft [size]="18" aria-hidden="true"></svg>
        </button>
        <span>Page {{ page() + 1 }}</span>
        <button
          type="button"
          class="icon-button"
          aria-label="Page suivante"
          [disabled]="!hasNextPage()"
          (click)="page.set(page() + 1)"
        >
          <svg lucideChevronRight [size]="18" aria-hidden="true"></svg>
        </button>
      </nav>
    }

    <p class="hint">
      Le coût d’un achat, frais compris, est réparti entre ses exemplaires au
      prorata de leur Price Trend Cardmarket, sauf coût saisi à la main.
    </p>
  `,
  styleUrl: './purchases.css',
  styles: `
    .small-button {
      text-decoration: none;
    }
  `,
})
export class Purchases {
  readonly current = inject(Organizations).current;
  readonly formatPrice = formatPrice;
  readonly formatDate = formatDate;
  readonly page = signal(0);

  private readonly base = computed(() => {
    const organization = this.current();
    return organization && `/api/organizations/${organization.id}`;
  });

  // Ne sert qu'à afficher ou masquer les actions : le serveur contrôle chaque appel.
  readonly access = httpResource<{ permissions: string[] }>(() =>
    this.base() ? `${this.base()}/me` : undefined,
  );
  readonly canManage = computed(
    () => this.access.value()?.permissions.includes('PURCHASE_MANAGE') ?? false,
  );

  readonly purchases = httpResource<Purchase[]>(() =>
    this.base()
      ? {
          url: `${this.base()}/purchases`,
          params: { take: PAGE_SIZE, skip: this.page() * PAGE_SIZE },
        }
      : undefined,
  );
  readonly summary = httpResource<PurchasesSummary>(() =>
    this.base() ? `${this.base()}/purchases/summary` : undefined,
  );
  // En erreur, `value()` lève une exception : la liste reste alors vide.
  readonly list = computed(() =>
    this.purchases.hasValue() ? this.purchases.value() : [],
  );
  readonly hasNextPage = computed(() => this.list().length === PAGE_SIZE);
  // Sans total chargé, les cases restent visibles, à zéro.
  readonly totals = computed(() =>
    this.summary.hasValue()
      ? this.summary.value()
      : { purchaseCount: 0, totalCost: '0' },
  );

  constructor() {
    // Changer d'organisation repart de la première page.
    effect(() => {
      this.current();
      this.page.set(0);
    });
  }

  count(value: number): string {
    return value.toLocaleString('fr-CH');
  }
}
