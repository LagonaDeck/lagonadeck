import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucidePackagePlus,
  LucideSearch,
  LucideTrash2,
} from '@lucide/angular';
import { RouterLink } from '@angular/router';
import { errorMessage } from './auth';
import {
  InventoryItem,
  InventorySummary,
  cardName,
  formatPrice,
  hideBrokenImage,
  itemValueTitle,
  LANGUAGES,
  LANGUAGE_FLAGS,
  priceTitle,
  productDetails,
} from './catalog';
import { InventoryAdd } from './inventory-add';
import { Chip } from './chip';
import { ItemState } from './item-state';
import { Organizations } from './organizations';

// Maximum accepté par l'API pour une page.
const PAGE_SIZE = 100;
const SEARCH_DELAY_MS = 250;

@Component({
  selector: 'app-inventory',
  imports: [
    InventoryAdd,
    Chip,
    ItemState,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePackagePlus,
    LucideSearch,
    LucideTrash2,
    RouterLink,
  ],
  template: `
    <div class="page-header">
      <h1>Inventaire</h1>
      @if (canManage()) {
        <button type="button" class="small-button" (click)="adding.set(true)">
          <svg lucidePackagePlus [size]="16" aria-hidden="true"></svg>
          Ajouter un produit
        </button>
      }
    </div>

    @if (summary.value(); as summary) {
      <dl class="summary">
        <div>
          <dt>Valeur du stock</dt>
          <dd>{{ formatPrice(summary.value) }}</dd>
        </div>
        <div>
          <dt>Exemplaires</dt>
          <dd>{{ count(summary.itemCount) }}</dd>
        </div>
      </dl>
      @if (summary.unpricedItemCount > 0) {
        <p class="hint">
          {{ summary.unpricedItemCount }}
          {{
            summary.unpricedItemCount > 1
              ? 'exemplaires ne sont pas comptés'
              : 'exemplaire n’est pas compté'
          }}
          dans la valeur : produit sans prix Cardmarket, ou carte gradée.
        </p>
      }
    }

    @if (adding() && current(); as organization) {
      <app-inventory-add
        [organizationId]="organization.id"
        (added)="reload()"
        (closed)="adding.set(false)"
      />
    }

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <label class="search">
      <svg lucideSearch [size]="18" aria-hidden="true"></svg>
      <input
        type="search"
        aria-label="Rechercher dans le stock"
        placeholder="Rechercher dans le stock"
        autocomplete="off"
        (input)="search($any($event.target).value)"
      />
    </label>

    <div class="table">
      <table>
        <thead>
          <tr>
            <th scope="col">Produit</th>
            <th scope="col">État</th>
            <th scope="col">Langue</th>
            <th scope="col" class="number">Prix</th>
            @if (canManage()) {
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (item of items.value() ?? []; track item.id) {
            <tr>
              <td>
                <a class="product" [routerLink]="item.id">
                  <span class="card-thumb">
                    @if (item.product.imageUrl) {
                      <img
                        [src]="item.product.imageUrl"
                        alt=""
                        loading="lazy"
                        (error)="hideBrokenImage($event)"
                      />
                    }
                  </span>
                  <span class="identity">
                    <strong>{{ cardName(item.product) }}</strong>
                    <span>{{ details(item) }}</span>
                  </span>
                </a>
              </td>
              <td><app-item-state [item]="item" /></td>
              <td>
                @if (item.language; as language) {
                  <app-chip
                    [text]="flags[language]"
                    [tooltip]="languages[language]"
                    tone="flag"
                  />
                } @else {
                  —
                }
              </td>
              <td
                class="number"
                [title]="itemValueTitle(item) ?? priceTitle(item.product)"
              >
                {{ formatPrice(item.price) }}
              </td>
              @if (canManage()) {
                <td>
                  <button
                    type="button"
                    class="icon-button discard"
                    [title]="'Supprimer ' + cardName(item.product)"
                    [attr.aria-label]="'Supprimer ' + cardName(item.product)"
                    (click)="remove(item)"
                  >
                    <svg lucideTrash2 [size]="16" aria-hidden="true"></svg>
                  </button>
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="empty" [attr.colspan]="canManage() ? 5 : 4">
                @if (items.isLoading()) {
                  Chargement…
                } @else if (query()) {
                  Aucun produit ne correspond à « {{ query() }} ».
                } @else {
                  Aucun produit en stock.
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (page() > 0 || hasNextPage()) {
      <nav class="pagination" aria-label="Pages de l’inventaire">
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
      Prix : Price Trend Cardmarket, mis à jour une fois par jour. C’est une
      référence par produit, pas une estimation selon l’état ou la langue.
    </p>
  `,
  styles: `
    /* La page ne défile pas : seul le tableau défile, dans la hauteur qui reste. */
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
    }

    :host > * {
      flex: none;
    }

    .search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      max-width: 28rem;
      color: var(--slate);
    }

    .search input {
      flex: 1;
      min-width: 0;
      padding: 0.45rem 0.7rem;
    }

    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    h1 {
      font-size: clamp(1.75rem, 3vw, 2.25rem);
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 0.75rem;
      margin: 0;
    }

    .summary div {
      padding: 0.85rem 1.1rem;
      border: 1px solid var(--rule);
      border-radius: 0.75rem;
      background: var(--surface);
    }

    .summary dt {
      color: var(--slate);
      font-size: 0.85rem;
    }

    .summary dd {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .summary + .hint {
      margin-top: -0.75rem;
    }

    /* Relatif : le texte masqué de l'en-tête reste dans la zone défilante
       au lieu d'élargir la page. */
    .table {
      position: relative;
      flex: 1 1 auto;
      min-height: 12rem;
      overflow: auto;
      border: 1px solid var(--rule);
      border-radius: 0.75rem;
      background: var(--surface);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 0.6rem 0.9rem;
      border-bottom: 1px solid var(--rule);
      text-align: left;
      white-space: nowrap;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--surface);
      color: var(--slate);
      font-size: 0.85rem;
      font-weight: 700;
    }

    .number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .product {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: inherit;
      text-decoration: none;
    }

    .identity {
      display: grid;
      min-width: 14rem;
      white-space: normal;
    }

    .product:hover strong {
      color: var(--blue);
      text-decoration: underline;
    }

    .identity span {
      color: var(--slate);
      font-size: 0.85rem;
      font-style: italic;
    }

    .empty {
      color: var(--slate);
      text-align: center;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class Inventory {
  private readonly http = inject(HttpClient);
  readonly current = inject(Organizations).current;
  readonly formatPrice = formatPrice;
  readonly priceTitle = priceTitle;
  readonly cardName = cardName;
  readonly hideBrokenImage = hideBrokenImage;
  readonly flags = LANGUAGE_FLAGS;
  readonly languages = LANGUAGES;
  readonly itemValueTitle = itemValueTitle;
  readonly query = signal('');
  readonly adding = signal(false);
  readonly page = signal(0);
  readonly error = signal('');

  private readonly base = computed(() => {
    const organization = this.current();
    return organization && `/api/organizations/${organization.id}`;
  });

  // Ne sert qu'à afficher ou masquer les actions : le serveur contrôle chaque appel.
  readonly access = httpResource<{ permissions: string[] }>(() =>
    this.base() ? `${this.base()}/me` : undefined,
  );
  readonly canManage = computed(
    () =>
      this.access.value()?.permissions.includes('INVENTORY_MANAGE') ?? false,
  );

  readonly items = httpResource<InventoryItem[]>(() =>
    this.base()
      ? {
          url: `${this.base()}/inventory`,
          params: {
            take: PAGE_SIZE,
            skip: this.page() * PAGE_SIZE,
            ...(this.query() && { search: this.query() }),
          },
        }
      : undefined,
  );
  readonly summary = httpResource<InventorySummary>(() =>
    this.base() ? `${this.base()}/inventory/summary` : undefined,
  );
  readonly hasNextPage = computed(
    () => this.items.value()?.length === PAGE_SIZE,
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Changer d'organisation repart de la première page, sans ajout en cours.
    effect(() => {
      this.current();
      this.page.set(0);
      this.adding.set(false);
      this.error.set('');
    });
  }

  reload(): void {
    this.items.reload();
    this.summary.reload();
  }

  count(value: number): string {
    return value.toLocaleString('fr-CH');
  }

  // Attend une courte pause dans la saisie avant d'interroger le serveur.
  search(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(0);
      this.query.set(value.trim());
    }, SEARCH_DELAY_MS);
  }

  details(item: InventoryItem): string {
    return productDetails(item.product);
  }

  remove(item: InventoryItem): void {
    if (!confirm(`Retirer ${cardName(item.product)} du stock ?`)) return;
    this.run(this.http.delete(`${this.base()}/inventory/${item.id}`));
  }

  private run(request: ReturnType<HttpClient['delete']>): void {
    this.error.set('');
    request.subscribe({
      next: () => this.reload(),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
