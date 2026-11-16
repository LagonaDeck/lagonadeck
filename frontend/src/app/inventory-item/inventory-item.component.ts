import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideTrendingDown,
  LucideTrendingUp,
} from '@lucide/angular';
import { AuthService } from '../services/auth.service';
import { errorMessage } from '../utils/form.util';
import {
  cardName,
  productDetails,
  PRICE_DIRECTIONS,
  PRODUCT_SOURCES,
} from '../models/product';
import {
  itemValueTitle,
  LANGUAGES,
  LANGUAGE_FLAGS,
} from '../models/inventory-item';
import {
  formatDate,
  formatPrice,
  formatTimestamp,
  hideBrokenImage,
} from '../utils/format.util';
import { ChipComponent } from '../chip/chip.component';
import { ItemStateComponent } from '../item-state/item-state.component';
import { CatalogService } from '../services/catalog.service';
import { InventoryService } from '../services/inventory.service';
import { PriceAveragesChartComponent } from '../price-averages-chart/price-averages-chart.component';
import { PriceHistoryChartComponent } from '../price-history-chart/price-history-chart.component';
import { PurchaseService } from '../services/purchase.service';

// Inclinaison en degrés entre les deux bords de la carte.
const TILT_RANGE = 16;

@Component({
  selector: 'app-inventory-item',
  imports: [
    LucideArrowLeft,
    LucideTrendingDown,
    LucideTrendingUp,
    ChipComponent,
    ItemStateComponent,
    PriceAveragesChartComponent,
    PriceHistoryChartComponent,
    RouterLink,
  ],
  templateUrl: './inventory-item.component.html',
  styleUrl: './inventory-item.component.css',
})
export class InventoryItemComponent {
  readonly catalogService = inject(CatalogService);
  readonly itemId = input.required<string>();
  readonly sources = PRODUCT_SOURCES;
  readonly directions = PRICE_DIRECTIONS;
  readonly cardName = cardName;
  readonly productDetails = productDetails;
  readonly formatPrice = formatPrice;
  readonly hideBrokenImage = hideBrokenImage;
  readonly flags = LANGUAGE_FLAGS;
  readonly languages = LANGUAGES;
  readonly itemValueTitle = itemValueTitle;
  readonly formatDate = formatDate;
  readonly date = formatTimestamp;
  readonly linkError = signal('');
  readonly reportError = signal('');
  readonly reported = signal(false);
  readonly auth = inject(AuthService);

  readonly item = inject(InventoryService).item(this.itemId);
  readonly purchase = inject(PurchaseService).purchasedItem(this.itemId);
  readonly history = this.catalogService.priceHistory(() =>
    this.item.hasValue() ? this.item.value().product : undefined,
  );

  link(event: SubmitEvent, productId: string): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const cardmarketId = Number(new FormData(form).get('cardmarketId'));
    this.saveLink(productId, cardmarketId, () => form.reset());
  }

  report(event: SubmitEvent, productId: string): void {
    event.preventDefault();
    const message = new FormData(event.target as HTMLFormElement).get(
      'message',
    );
    this.reportError.set('');
    this.catalogService.report({ productId, message }).subscribe({
      next: () => this.reported.set(true),
      error: (error: HttpErrorResponse) =>
        this.reportError.set(errorMessage(error)),
    });
  }

  unlink(productId: string): void {
    if (
      !confirm('Retirer le lien Cardmarket ? Le produit n’aura plus de prix.')
    ) {
      return;
    }
    this.saveLink(productId, null);
  }

  // La carte penche vers le pointeur, comme une carte qu'on tient en main.
  tilt(event: PointerEvent): void {
    const figure = event.currentTarget as HTMLElement;
    const box = figure.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    figure.style.setProperty('--tilt-x', `${-y * TILT_RANGE}deg`);
    figure.style.setProperty('--tilt-y', `${x * TILT_RANGE}deg`);
  }

  untilt(event: PointerEvent): void {
    const figure = event.currentTarget as HTMLElement;
    figure.style.removeProperty('--tilt-x');
    figure.style.removeProperty('--tilt-y');
  }

  private saveLink(
    productId: string,
    cardmarketId: number | null,
    done?: () => void,
  ): void {
    this.linkError.set('');
    this.catalogService.linkCardmarket(productId, cardmarketId).subscribe({
      next: () => {
        done?.();
        this.item.reload();
      },
      error: (error: HttpErrorResponse) =>
        this.linkError.set(errorMessage(error)),
    });
  }
}
