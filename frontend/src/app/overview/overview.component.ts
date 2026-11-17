import { HttpResourceRef } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import { InventoryItem } from '../models/inventory-item';
import { cardName, productDetails } from '../models/product';
import { InventoryService } from '../services/inventory.service';
import { OrganizationService } from '../services/organization.service';
import { PurchaseService } from '../services/purchase.service';
import {
  formatCount,
  formatPrice,
  formatTimestamp,
} from '../utils/format.util';

interface Widget {
  id: string;
  label: string;
  kind: 'stat' | 'list';
}

interface WidgetPreference {
  id: string;
  visible: boolean;
}

const PREFERENCES_KEY = 'dashboard-widgets';
const DAY_MS = 24 * 60 * 60 * 1000;
const DORMANT_DAYS = 90;
const LIST_SIZE = 5;

const WIDGETS: Widget[] = [
  { id: 'stockValue', label: 'Valeur du stock', kind: 'stat' },
  { id: 'stockCount', label: 'Nombre de cartes en stock', kind: 'stat' },
  { id: 'investedCapital', label: 'Capital investi', kind: 'stat' },
  { id: 'immobilizedCapital', label: 'Capital immobilisé', kind: 'stat' },
  { id: 'potentialProfit', label: 'Bénéfice potentiel', kind: 'stat' },
  { id: 'recentlyAcquired', label: 'Cartes récemment acquises', kind: 'list' },
  { id: 'dormantStock', label: 'Stock dormant', kind: 'list' },
];

// Le capital investi suit la date d'achat, les listes la date d'entrée au
// stock : un achat saisi en retard n'apparaît pas au même endroit.
const LIST_HINTS: Record<string, string> = {
  recentlyAcquired: 'Par date d’entrée au stock, sur la période.',
  dormantStock: `Au stock depuis plus de ${DORMANT_DAYS} jours.`,
};

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
  count ? ` Hors ${formatCount(count)} sans prix.` : '';

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
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css',
})
export class OverviewComponent {
  readonly organizations = inject(OrganizationService);
  private readonly inventoryService = inject(InventoryService);
  private readonly purchaseService = inject(PurchaseService);
  readonly periods = PERIODS;
  readonly listHints = LIST_HINTS;
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

  // Début de la période, à minuit UTC : le format des dates d'achat de l'API.
  private readonly periodStart = computed(() =>
    this.periodDays()
      ? new Date(Date.now() - this.periodDays() * DAY_MS)
          .toISOString()
          .slice(0, 10)
      : undefined,
  );

  private readonly inventorySummary = this.inventoryService.summary();
  private readonly stockSummary = this.purchaseService.stockSummary();
  private readonly purchasesSummary = this.purchaseService.summary(
    this.periodStart,
  );
  private readonly recentItems = this.inventoryService.byEntryDate(
    'recent',
    LIST_SIZE,
  );
  private readonly oldestItems = this.inventoryService.byEntryDate(
    'oldest',
    LIST_SIZE,
  );

  widget(id: string): Widget {
    return WIDGETS.find((widget) => widget.id === id)!;
  }

  stat({ id }: Widget): { value: string; hint: string } {
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
          value: inventory ? formatCount(inventory.itemCount) : '—',
          hint: 'Produits scellés compris.',
        };
      case 'investedCapital':
        return {
          value: formatPrice(purchases?.totalCost ?? null),
          hint: 'Achats datés de la période, frais compris.',
        };
      case 'immobilizedCapital':
        return {
          value: formatPrice(stock?.immobilizedCapital ?? null),
          hint:
            'Coût d’achat du stock actuel.' +
            (stock?.uncostedItemCount
              ? ` Hors ${formatCount(stock.uncostedItemCount)} sans coût connu.`
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
      .map((item) => ({ item, detail: formatTimestamp(item.createdAt) }));
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
