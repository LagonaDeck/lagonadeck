import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideTrash2 } from '@lucide/angular';
import { errorMessage } from '../utils/form.util';
import { LANGUAGES, LANGUAGE_FLAGS } from '../models/inventory-item';
import { cardName } from '../models/product';
import { formatPrice, hideBrokenImage, formatDate } from '../utils/format.util';
import { ChipComponent } from '../chip/chip.component';
import { ItemStateComponent } from '../item-state/item-state.component';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseDetail, PurchaseLine, lineDetails } from '../models/purchase';

@Component({
  selector: 'app-purchase',
  imports: [
    ChipComponent,
    ItemStateComponent,
    LucideArrowLeft,
    LucideTrash2,
    RouterLink,
  ],
  templateUrl: './purchase.component.html',
  styleUrls: ['../styles/purchases.css', './purchase.component.css'],
})
export class PurchaseComponent {
  private readonly purchaseService = inject(PurchaseService);
  private readonly router = inject(Router);
  readonly purchaseId = input.required<string>();
  readonly formatPrice = formatPrice;
  readonly formatDate = formatDate;
  readonly lineDetails = lineDetails;
  readonly hideBrokenImage = hideBrokenImage;
  readonly flags = LANGUAGE_FLAGS;
  readonly languages = LANGUAGES;
  readonly error = signal('');

  readonly canManage = this.purchaseService.canManage();
  readonly detail = this.purchaseService.detail(this.purchaseId);

  name(line: PurchaseLine): string {
    return cardName({ ...line, name: line.productName });
  }

  remove(purchase: PurchaseDetail): void {
    const count = purchase.itemCount;
    if (
      !confirm(
        `Supprimer cet achat et retirer ${count > 1 ? `ses ${count} exemplaires` : 'son exemplaire'} du stock ?`,
      )
    ) {
      return;
    }
    this.error.set('');
    this.purchaseService.delete(purchase.id).subscribe({
      next: () => void this.router.navigate(['/app/purchases']),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
