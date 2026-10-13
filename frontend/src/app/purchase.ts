import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideTrash2 } from '@lucide/angular';
import { errorMessage } from './auth';
import {
  LANGUAGES,
  LANGUAGE_FLAGS,
  cardName,
  formatPrice,
  hideBrokenImage,
} from './catalog';
import { Chip } from './chip';
import { ItemState } from './item-state';
import { Organizations } from './organizations';
import {
  PurchaseDetail,
  PurchaseLine,
  formatDate,
  lineDetails,
} from './purchases';

@Component({
  selector: 'app-purchase',
  imports: [Chip, ItemState, LucideArrowLeft, LucideTrash2, RouterLink],
  template: `
    <a class="back" routerLink="/app/purchases">
      <svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>
      Achats
    </a>

    @if (detail.hasValue()) {
      @let purchase = detail.value();
      <div class="page-header">
        <div>
          <h1>{{ purchase.supplier }}</h1>
          <p class="hint">Acheté le {{ formatDate(purchase.purchasedAt) }}</p>
        </div>
        @if (canManage()) {
          <button
            type="button"
            class="small-button delete"
            (click)="remove(purchase)"
          >
            <svg lucideTrash2 [size]="16" aria-hidden="true"></svg>
            Supprimer l’achat
          </button>
        }
      </div>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      <dl class="summary">
        <div>
          <dt>Coût total</dt>
          <dd>{{ formatPrice(purchase.totalCost) }}</dd>
          <p class="hint">
            {{ formatPrice(purchase.price) }} et
            {{ formatPrice(purchase.fees) }} de frais
          </p>
        </div>
        <div>
          <dt>Valeur à l’achat</dt>
          <dd>{{ formatPrice(purchase.marketValue) }}</dd>
          <p class="hint">Price Trend Cardmarket du jour de l’achat</p>
        </div>
        <div>
          <dt>Exemplaires</dt>
          <dd>{{ purchase.itemCount }}</dd>
        </div>
      </dl>

      @if (purchase.notes) {
        <p class="notes">{{ purchase.notes }}</p>
      }

      <div class="table">
        <table>
          <thead>
            <tr>
              <th scope="col">Produit</th>
              <th scope="col">État</th>
              <th scope="col">Langue</th>
              <th scope="col" class="number">Price Trend</th>
              <th scope="col" class="number">Coût</th>
            </tr>
          </thead>
          <tbody>
            @for (line of purchase.lines; track line.id) {
              <tr>
                <td>
                  <a
                    class="product"
                    [routerLink]="['/app/inventory', line.inventoryItemId]"
                  >
                    <span class="card-thumb">
                      @if (line.imageUrl) {
                        <img
                          [src]="line.imageUrl"
                          alt=""
                          loading="lazy"
                          (error)="hideBrokenImage($event)"
                        />
                      }
                    </span>
                    <span class="identity">
                      <strong>{{ name(line) }}</strong>
                      <span>{{ lineDetails(line) }}</span>
                    </span>
                  </a>
                </td>
                <td><app-item-state [item]="line" /></td>
                <td>
                  @if (line.language; as language) {
                    <app-chip
                      [text]="flags[language]"
                      [tooltip]="languages[language]"
                      tone="flag"
                    />
                  } @else {
                    —
                  }
                </td>
                <td class="number">{{ formatPrice(line.marketPrice) }}</td>
                <td class="number">{{ formatPrice(line.cost) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <p class="hint">
        Price Trend du jour de l’achat. Le coût de chaque exemplaire est sa part
        du lot, frais compris : au prorata du Price Trend, sauf coût saisi à la
        main ; un exemplaire sans prix compte pour la moyenne des autres.
      </p>
    } @else if (detail.isLoading()) {
      <p class="hint">Chargement…</p>
    } @else {
      <p class="hint">Aucun achat trouvé.</p>
    }
  `,
  styleUrl: './purchases.css',
  styles: `
    .summary .hint {
      font-size: 0.8rem;
    }

    .notes {
      max-width: 40rem;
      white-space: pre-line;
    }

    .small-button.delete {
      background: var(--danger);
    }

    .small-button.delete:hover {
      background: color-mix(in srgb, var(--danger) 80%, var(--ink));
    }
  `,
})
export class PurchasePage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly current = inject(Organizations).current;
  readonly purchaseId = input.required<string>();
  readonly formatPrice = formatPrice;
  readonly formatDate = formatDate;
  readonly lineDetails = lineDetails;
  readonly hideBrokenImage = hideBrokenImage;
  readonly flags = LANGUAGE_FLAGS;
  readonly languages = LANGUAGES;
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
    () => this.access.value()?.permissions.includes('PURCHASE_MANAGE') ?? false,
  );

  readonly detail = httpResource<PurchaseDetail>(() =>
    this.base() ? `${this.base()}/purchases/${this.purchaseId()}` : undefined,
  );

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
    this.http.delete(`${this.base()}/purchases/${purchase.id}`).subscribe({
      next: () => void this.router.navigate(['/app/purchases']),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
