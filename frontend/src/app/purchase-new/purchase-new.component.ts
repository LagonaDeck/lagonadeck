import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucidePackagePlus,
  LucideTrash2,
} from '@lucide/angular';
import { errorMessage, formValues } from '../utils/form.util';
import { LANGUAGES, LANGUAGE_FLAGS } from '../models/inventory-item';
import { cardName, productDetails } from '../models/product';
import { formatPrice, hideBrokenImage } from '../utils/format.util';
import { ChipComponent } from '../chip/chip.component';
import { InventoryAddComponent } from '../inventory-add/inventory-add.component';
import { PickedItem, PurchaseDraftLine } from '../models/purchase';
import { ItemStateComponent } from '../item-state/item-state.component';
import { OrganizationService } from '../services/organization.service';
import { PurchaseService } from '../services/purchase.service';

interface DraftLine extends PurchaseDraftLine {
  key: number;
}

// La date locale au format de l'API (AAAA-MM-JJ), qui est celui de la Suède.
const today = () => new Date().toLocaleDateString('sv');

@Component({
  selector: 'app-purchase-new',
  imports: [
    ChipComponent,
    InventoryAddComponent,
    ItemStateComponent,
    LucideArrowLeft,
    LucidePackagePlus,
    LucideTrash2,
    RouterLink,
  ],
  templateUrl: './purchase-new.component.html',
  styleUrls: ['../styles/purchases.css', './purchase-new.component.css'],
})
export class PurchaseNewComponent {
  readonly purchaseService = inject(PurchaseService);
  private readonly router = inject(Router);
  readonly current = inject(OrganizationService).current;
  readonly cardName = cardName;
  readonly productDetails = productDetails;
  readonly formatPrice = formatPrice;
  readonly hideBrokenImage = hideBrokenImage;
  readonly flags = LANGUAGE_FLAGS;
  readonly languages = LANGUAGES;
  readonly today = today();
  readonly picking = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly price = signal(0);
  readonly fees = signal(0);
  readonly lines = signal<DraftLine[]>([]);
  private nextKey = 0;

  readonly itemCount = computed(() =>
    this.purchaseService.itemCount(this.lines()),
  );
  readonly marketValue = computed(() =>
    this.purchaseService.marketValue(this.lines()),
  );
  readonly totalCost = computed(() => this.price() + this.fees());

  addLine(item: PickedItem): void {
    this.lines.update((lines) => [
      ...lines,
      { key: this.nextKey++, item, quantity: 1, unitCost: null },
    ]);
  }

  removeLine(removed: DraftLine): void {
    this.lines.update((lines) => lines.filter((line) => line !== removed));
  }

  // Le champ suit la saisie et le signal le suit, jamais l'inverse : « 1. »
  // est vide pour un input number, le réécrire effacerait la frappe.
  update(changed: DraftLine, values: Partial<DraftLine>): void {
    this.lines.update((lines) =>
      lines.map((line) => (line === changed ? { ...line, ...values } : line)),
    );
  }

  cost(event: Event): number | null {
    const value = (event.target as HTMLInputElement).value;
    return value === '' ? null : Number(value);
  }

  name(line: DraftLine): string {
    return cardName(line.item.product);
  }

  state(item: PickedItem) {
    return {
      condition: item.condition ?? null,
      gradingCompany: item.gradingCompany ?? null,
      grade: item.grade ?? null,
      reverse: item.reverse ?? false,
    };
  }

  save(event: SubmitEvent): void {
    const form = formValues(event) as Record<string, string>;
    if (!this.current()) return;
    this.error.set('');
    this.saving.set(true);
    this.purchaseService.create(form, this.lines()).subscribe({
      next: (purchase) =>
        void this.router.navigate(['/app/purchases', purchase.id]),
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
