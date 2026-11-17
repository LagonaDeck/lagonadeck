import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucidePackagePlus,
  LucideSearch,
  LucideTrash2,
} from '@lucide/angular';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../utils/form.util';
import {
  InventoryItem,
  itemValueTitle,
  LANGUAGES,
  LANGUAGE_FLAGS,
} from '../models/inventory-item';
import { cardName, priceTitle, productDetails } from '../models/product';
import {
  formatCount,
  formatPrice,
  hideBrokenImage,
} from '../utils/format.util';
import { InventoryAddComponent } from '../inventory-add/inventory-add.component';
import { ChipComponent } from '../chip/chip.component';
import { ItemStateComponent } from '../item-state/item-state.component';
import { InventoryService } from '../services/inventory.service';
import { OrganizationService } from '../services/organization.service';

const SEARCH_DELAY_MS = 250;

@Component({
  selector: 'app-inventory',
  imports: [
    InventoryAddComponent,
    ChipComponent,
    ItemStateComponent,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePackagePlus,
    LucideSearch,
    LucideTrash2,
    RouterLink,
  ],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css',
})
export class InventoryComponent {
  private readonly inventoryService = inject(InventoryService);
  readonly current = inject(OrganizationService).current;
  readonly formatPrice = formatPrice;
  readonly count = formatCount;
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

  readonly canManage = this.inventoryService.canManage();
  readonly items = this.inventoryService.list(this.page, this.query);
  readonly summary = this.inventoryService.summary();
  readonly hasNextPage = computed(
    () =>
      this.items.hasValue() &&
      this.inventoryService.hasNextPage(this.items.value()),
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
    this.error.set('');
    this.inventoryService.remove(item.id).subscribe({
      next: () => this.reload(),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
