import { HttpResourceRef, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import { RouterLink } from '@angular/router';
import {
  InventoryItem,
  InventorySummary,
  cardName,
  formatPrice,
  productDetails,
} from './catalog';
import { Organizations } from './organizations';

interface PurchasesSummary {
  totalCost: string;
}

interface StockSummary {
  immobilizedCapital: string;
  potentialProfit: string;
  unpricedItemCount: number;
  uncostedItemCount: number;
}

interface Widget {
  id: string;
  label: string;
  kind: 'stat' | 'list';
  // TODO(ventes) : brancher ces widgets quand les ventes existeront.
  needsSales?: boolean;
}

interface WidgetPreference {
  id: string;
  visible: boolean;
}

// Par défaut, ce qui a déjà des données passe avant ce qui attend les ventes.
const WIDGETS: Widget[] = [
  { id: 'stockValue', label: 'Valeur du stock', kind: 'stat' },
  { id: 'stockCount', label: 'Nombre de cartes en stock', kind: 'stat' },
  { id: 'investedCapital', label: 'Capital investi', kind: 'stat' },
  { id: 'immobilizedCapital', label: 'Capital immobilisé', kind: 'stat' },
  { id: 'potentialProfit', label: 'Bénéfice potentiel', kind: 'stat' },
  {
    id: 'revenue',
    label: 'Chiffre d’affaires',
    kind: 'stat',
    needsSales: true,
  },
  { id: 'netProfit', label: 'Bénéfice net', kind: 'stat', needsSales: true },
  {
    id: 'realizedProfit',
    label: 'Bénéfice réalisé',
    kind: 'stat',
    needsSales: true,
  },
  { id: 'averageRoi', label: 'ROI moyen', kind: 'stat', needsSales: true },
  {
    id: 'averageMargin',
    label: 'Marge moyenne',
    kind: 'stat',
    needsSales: true,
  },
  {
    id: 'salesCount',
    label: 'Nombre de ventes',
    kind: 'stat',
    needsSales: true,
  },
  { id: 'recentlyAcquired', label: 'Cartes récemment acquises', kind: 'list' },
  { id: 'dormantStock', label: 'Stock dormant', kind: 'list' },
  {
    id: 'salesTrend',
    label: 'Évolution des ventes',
    kind: 'list',
    needsSales: true,
  },
  {
    id: 'profitTrend',
    label: 'Évolution du bénéfice',
    kind: 'list',
    needsSales: true,
  },
  {
    id: 'bestCards',
    label: 'Meilleures cartes',
    kind: 'list',
    needsSales: true,
  },
  {
    id: 'worstCards',
    label: 'Pires performances',
    kind: 'list',
    needsSales: true,
  },
  { id: 'bestLots', label: 'Meilleurs lots', kind: 'list', needsSales: true },
  {
    id: 'recentlySold',
    label: 'Cartes récemment vendues',
    kind: 'list',
    needsSales: true,
  },
];

const PREFERENCES_KEY = 'dashboard-widgets';
const DAY_MS = 24 * 60 * 60 * 1000;
const DORMANT_DAYS = 90;
const LIST_SIZE = 5;

const PERIODS = [
  { days: 30, label: '30 derniers jours' },
  { days: 90, label: '90 derniers jours' },
  { days: 365, label: '12 derniers mois' },
  { days: 0, label: 'Depuis le début' },
];

const defaultPreferences = (): WidgetPreference[] =>
  WIDGETS.map(({ id }) => ({ id, visible: true }));

// Un widget ajouté depuis le dernier enregistrement arrive à la fin de la liste.
function readPreferences(): WidgetPreference[] {
  const defaults = defaultPreferences();
  try {
    const stored = JSON.parse(
      localStorage.getItem(PREFERENCES_KEY) ?? '[]',
    ) as WidgetPreference[];
    const known = stored.filter(({ id }) =>
      defaults.some((widget) => widget.id === id),
    );
    return [
      ...known,
      ...defaults.filter(({ id }) => !known.some((kept) => kept.id === id)),
    ];
  } catch {
    return defaults;
  }
}

// En erreur, `value()` lève une exception : le widget reste alors sans valeur.
const loaded = <T>(resource: HttpResourceRef<T | undefined>): T | undefined =>
  resource.hasValue() ? resource.value() : undefined;

const unpricedHint = (count: number): string =>
  count ? ` Hors ${count.toLocaleString('fr-CH')} sans prix.` : '';

const daysSince = (date: string): number =>
  Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS);

@Component({
  selector: 'app-overview',
  imports: [
    LucideArrowDown,
    LucideArrowUp,
    LucideSlidersHorizontal,
    RouterLink,
  ],
  template: `
    <div class="page-header">
      <h1>Tableau de bord</h1>
      <button
        type="button"
        class="small-button"
        [attr.aria-expanded]="customizing()"
        (click)="customizing.set(!customizing())"
      >
        <svg lucideSlidersHorizontal [size]="16" aria-hidden="true"></svg>
        Personnaliser
      </button>
    </div>

    <div class="filters">
      <label>
        Période
        <select [value]="periodDays()" (change)="selectPeriod($event)">
          @for (period of periods; track period.days) {
            <option
              [value]="period.days"
              [selected]="period.days === periodDays()"
            >
              {{ period.label }}
            </option>
          }
        </select>
      </label>
      <label>
        Organisation
        <select (change)="selectOrganization($event)">
          @for (organization of organizations.list(); track organization.id) {
            <option
              [value]="organization.id"
              [selected]="organization.id === organizations.current()?.id"
            >
              {{ organization.name }}
            </option>
          }
        </select>
      </label>
      <label title="Seul Pokémon est géré pour l’instant">
        TCG
        <select disabled>
          <option>Pokémon</option>
        </select>
      </label>
    </div>

    @if (customizing()) {
      <section class="customize" aria-label="Personnaliser les widgets">
        <ul>
          @for (
            preference of preferences();
            track preference.id;
            let i = $index
          ) {
            <li>
              <label>
                <input
                  type="checkbox"
                  [checked]="preference.visible"
                  (change)="toggleWidget(preference.id)"
                />
                {{ widget(preference.id).label }}
              </label>
              <span class="move">
                <button
                  type="button"
                  class="icon-button"
                  [attr.aria-label]="'Monter ' + widget(preference.id).label"
                  [disabled]="i === 0"
                  (click)="moveWidget(i, -1)"
                >
                  <svg lucideArrowUp [size]="16" aria-hidden="true"></svg>
                </button>
                <button
                  type="button"
                  class="icon-button"
                  [attr.aria-label]="'Descendre ' + widget(preference.id).label"
                  [disabled]="i === preferences().length - 1"
                  (click)="moveWidget(i, 1)"
                >
                  <svg lucideArrowDown [size]="16" aria-hidden="true"></svg>
                </button>
              </span>
            </li>
          }
        </ul>
        <button type="button" class="link-button" (click)="resetWidgets()">
          Réinitialiser
        </button>
      </section>
    }

    <div class="widgets">
      @for (widget of visibleWidgets(); track widget.id) {
        @if (widget.kind === 'stat') {
          <section class="widget">
            <h2>{{ widget.label }}</h2>
            <p class="value">{{ stat(widget).value }}</p>
            <p class="hint">{{ stat(widget).hint }}</p>
          </section>
        } @else {
          <section class="widget list">
            <h2>{{ widget.label }}</h2>
            @if (widget.needsSales) {
              <p class="hint">{{ salesHint }}</p>
            } @else {
              <ul>
                @for (row of rows(widget.id); track row.item.id) {
                  <li>
                    <a [routerLink]="['/app/inventory', row.item.id]">
                      <strong>{{ cardName(row.item.product) }}</strong>
                      <span class="hint">{{
                        productDetails(row.item.product)
                      }}</span>
                    </a>
                    <span class="meta">
                      {{ formatPrice(row.item.price) }}
                      <span class="hint">{{ row.detail }}</span>
                    </span>
                  </li>
                } @empty {
                  <li class="hint">{{ emptyText(widget.id) }}</li>
                }
              </ul>
            }
          </section>
        }
      } @empty {
        <p class="hint">
          Aucun widget affiché : choisissez-en dans Personnaliser.
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    h1 {
      font-size: clamp(1.75rem, 3vw, 2.25rem);
    }

    h2 {
      margin: 0;
      color: var(--slate);
      font-size: 0.85rem;
      font-weight: 700;
    }

    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .filters label {
      display: grid;
      gap: 0.25rem;
      color: var(--slate);
      font-size: 0.85rem;
    }

    select {
      min-width: 0;
      padding: 0.45rem 0.6rem;
      border: 2px solid var(--rule);
      border-radius: 0.5rem;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
    }

    select:disabled {
      color: var(--slate);
      cursor: not-allowed;
    }

    .customize,
    .widget {
      padding: 0.85rem 1.1rem;
      border: 1px solid var(--rule);
      border-radius: 0.75rem;
      background: var(--surface);
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .customize ul {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: 0.25rem 1.5rem;
      margin-bottom: 0.75rem;
    }

    .customize li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .customize label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .customize input {
      width: auto;
    }

    .move {
      display: flex;
    }

    .widgets {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      grid-auto-flow: dense;
      gap: 0.75rem;
    }

    .list {
      grid-column: span 2;
    }

    .value {
      margin: 0.15rem 0;
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .list ul {
      margin-top: 0.5rem;
    }

    .list p {
      margin: 0.5rem 0 0;
    }

    .list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-block: 0.5rem;
      border-top: 1px solid var(--rule);
    }

    .list li:first-child {
      border-top: 0;
    }

    .list a {
      display: grid;
      min-width: 0;
      color: inherit;
      text-decoration: none;
    }

    .list a:hover strong {
      color: var(--blue);
      text-decoration: underline;
    }

    .meta {
      display: grid;
      flex: none;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    @media (max-width: 36rem) {
      .list {
        grid-column: auto;
      }
    }
  `,
})
export class Overview {
  readonly organizations = inject(Organizations);
  readonly periods = PERIODS;
  readonly salesHint = 'Disponible avec les ventes';
  readonly cardName = cardName;
  readonly productDetails = productDetails;
  readonly formatPrice = formatPrice;
  readonly periodDays = signal(0);
  readonly customizing = signal(false);
  readonly preferences = signal(readPreferences());

  readonly visibleWidgets = computed(() =>
    this.preferences()
      .filter(({ visible }) => visible)
      .map(({ id }) => this.widget(id)),
  );

  private readonly base = computed(() => {
    const organization = this.organizations.current();
    return organization && `/api/organizations/${organization.id}`;
  });
  // Début de la période, à minuit UTC : le format des dates d'achat de l'API.
  private readonly periodStart = computed(() =>
    this.periodDays()
      ? new Date(Date.now() - this.periodDays() * DAY_MS)
          .toISOString()
          .slice(0, 10)
      : undefined,
  );

  private readonly inventorySummary = httpResource<InventorySummary>(() =>
    this.base() ? `${this.base()}/inventory/summary` : undefined,
  );
  private readonly stockSummary = httpResource<StockSummary>(() =>
    this.base() ? `${this.base()}/purchases/stock-summary` : undefined,
  );
  private readonly purchasesSummary = httpResource<PurchasesSummary>(() => {
    const from = this.periodStart();
    return (
      this.base() &&
      `${this.base()}/purchases/summary${from ? `?from=${from}` : ''}`
    );
  });
  private readonly recentItems = httpResource<InventoryItem[]>(() =>
    this.base()
      ? { url: `${this.base()}/inventory`, params: { take: LIST_SIZE } }
      : undefined,
  );
  private readonly oldestItems = httpResource<InventoryItem[]>(() =>
    this.base()
      ? {
          url: `${this.base()}/inventory`,
          params: { take: LIST_SIZE, sort: 'oldest' },
        }
      : undefined,
  );

  widget(id: string): Widget {
    return WIDGETS.find((widget) => widget.id === id)!;
  }

  stat({ id, needsSales }: Widget): { value: string; hint: string } {
    if (needsSales) return { value: '—', hint: this.salesHint };
    const inventory = loaded(this.inventorySummary);
    const stock = loaded(this.stockSummary);
    const purchases = loaded(this.purchasesSummary);
    switch (id) {
      case 'stockValue':
        return {
          value: formatPrice(inventory?.value ?? null),
          hint:
            'Au Price Trend Cardmarket.' +
            unpricedHint(inventory?.unpricedItemCount ?? 0),
        };
      case 'stockCount':
        return {
          value: inventory?.itemCount.toLocaleString('fr-CH') ?? '—',
          hint: 'Produits scellés compris.',
        };
      case 'investedCapital':
        return {
          value: formatPrice(purchases?.totalCost ?? null),
          hint: 'Achats de la période, frais compris.',
        };
      case 'immobilizedCapital':
        return {
          value: formatPrice(stock?.immobilizedCapital ?? null),
          hint:
            'Coût d’achat du stock actuel.' +
            (stock?.uncostedItemCount
              ? ` Hors ${stock.uncostedItemCount.toLocaleString('fr-CH')} sans coût connu.`
              : ''),
        };
      default:
        return {
          value: formatPrice(stock?.potentialProfit ?? null),
          hint:
            'Price Trend moins coût d’achat.' +
            unpricedHint(stock?.unpricedItemCount ?? 0),
        };
    }
  }

  // Les listes sont triées par date : garder ce qui passe le filtre de date
  // revient à lire ce filtre sur tout le stock.
  rows(id: string): { item: InventoryItem; detail: string }[] {
    if (id === 'dormantStock') {
      return (loaded(this.oldestItems) ?? [])
        .filter(({ createdAt }) => daysSince(createdAt) >= DORMANT_DAYS)
        .map((item) => ({
          item,
          detail: `Depuis ${daysSince(item.createdAt)} jours`,
        }));
    }
    const start = this.periodStart();
    return (loaded(this.recentItems) ?? [])
      .filter(({ createdAt }) => !start || createdAt >= start)
      .map((item) => ({
        item,
        detail: new Date(item.createdAt).toLocaleDateString('fr-CH'),
      }));
  }

  emptyText(id: string): string {
    return id === 'dormantStock'
      ? `Aucune carte en stock depuis plus de ${DORMANT_DAYS} jours.`
      : 'Aucune carte acquise sur cette période.';
  }

  selectPeriod(event: Event): void {
    this.periodDays.set(Number((event.target as HTMLSelectElement).value));
  }

  selectOrganization(event: Event): void {
    this.organizations.select((event.target as HTMLSelectElement).value);
  }

  toggleWidget(id: string): void {
    this.savePreferences(
      this.preferences().map((preference) =>
        preference.id === id
          ? { ...preference, visible: !preference.visible }
          : preference,
      ),
    );
  }

  moveWidget(index: number, offset: -1 | 1): void {
    const preferences = [...this.preferences()];
    const [moved] = preferences.splice(index, 1);
    preferences.splice(index + offset, 0, moved);
    this.savePreferences(preferences);
  }

  resetWidgets(): void {
    this.savePreferences(defaultPreferences());
  }

  private savePreferences(preferences: WidgetPreference[]): void {
    this.preferences.set(preferences);
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Stockage indisponible : le choix ne survit pas au rechargement.
    }
  }
}
