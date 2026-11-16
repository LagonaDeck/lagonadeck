import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideEye,
  LucidePlus,
} from '@lucide/angular';
import { RouterLink } from '@angular/router';
import { formatCount, formatDate, formatPrice } from '../utils/format.util';
import { OrganizationService } from '../services/organization.service';
import { PurchaseService } from '../services/purchase.service';

@Component({
  selector: 'app-purchases',
  imports: [
    LucideChevronLeft,
    LucideChevronRight,
    LucideEye,
    LucidePlus,
    RouterLink,
  ],
  templateUrl: './purchases.component.html',
  styleUrls: ['../styles/purchases.css', './purchases.component.css'],
})
export class PurchasesComponent {
  private readonly purchaseService = inject(PurchaseService);
  readonly current = inject(OrganizationService).current;
  readonly formatPrice = formatPrice;
  readonly count = formatCount;
  readonly formatDate = formatDate;
  readonly page = signal(0);

  readonly canManage = this.purchaseService.canManage();
  readonly purchases = this.purchaseService.list(this.page);
  readonly summary = this.purchaseService.summary();
  // En erreur, `value()` lève une exception : la liste reste alors vide.
  readonly list = computed(() =>
    this.purchases.hasValue() ? this.purchases.value() : [],
  );
  readonly hasNextPage = computed(() =>
    this.purchaseService.hasNextPage(this.list()),
  );
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
}
