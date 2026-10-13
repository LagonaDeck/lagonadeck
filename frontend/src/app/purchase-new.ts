import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucidePackagePlus,
  LucideTrash2,
} from '@lucide/angular';
import { errorMessage, formValues } from './auth';
import {
  LANGUAGES,
  LANGUAGE_FLAGS,
  cardName,
  formatPrice,
  hideBrokenImage,
  productDetails,
} from './catalog';
import { Chip } from './chip';
import { InventoryAdd, PickedItem } from './inventory-add';
import { ItemState } from './item-state';
import { Organizations } from './organizations';
import { PurchaseDetail } from './purchases';

interface DraftLine {
  key: number;
  item: PickedItem;
  quantity: number;
  unitCost: number | null;
}

// Même maximum que l'API : chaque unité devient un exemplaire du stock.
const MAX_ITEMS = 100;

// Prix de l'exemplaire tel que le stock le valorisera : celui de la reverse
// pour une reverse, aucun pour une carte gradée.
const unitPrice = ({ product, reverse, gradingCompany }: PickedItem) => {
  if (gradingCompany) return null;
  const price = reverse ? product.cardmarket?.trendHolo : product.price;
  return price && Number(price) > 0 ? Number(price) : null;
};

// La date locale au format de l'API (AAAA-MM-JJ), qui est celui de la Suède.
const today = () => new Date().toLocaleDateString('sv');

@Component({
  selector: 'app-purchase-new',
  imports: [
    Chip,
    InventoryAdd,
    ItemState,
    LucideArrowLeft,
    LucidePackagePlus,
    LucideTrash2,
    RouterLink,
  ],
  template: `
    <a class="back" routerLink="/app/purchases">
      <svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>
      Achats
    </a>
    <h1>Nouvel achat</h1>

    <form (submit)="save($event)">
      <fieldset class="details">
        <legend class="visually-hidden">Achat</legend>
        <label>
          Fournisseur
          <input
            name="supplier"
            maxlength="100"
            required
            placeholder="Vinted, Cardmarket, bourse…"
          />
        </label>
        <label>
          Date
          <input name="purchasedAt" type="date" required [value]="today" />
        </label>
        <label>
          Prix payé (€)
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            (input)="price.set(+$any($event.target).value)"
          />
        </label>
        <label>
          Frais (€)
          <input
            name="fees"
            type="number"
            min="0"
            step="0.01"
            value="0"
            title="Port, commissions"
            (input)="fees.set(+$any($event.target).value)"
          />
        </label>
        <label class="wide">
          Notes
          <textarea name="notes" rows="2" maxlength="1000"></textarea>
        </label>
      </fieldset>

      <div class="section-header">
        <h2>Exemplaires</h2>
        <button type="button" class="small-button" (click)="picking.set(true)">
          <svg lucidePackagePlus [size]="16" aria-hidden="true"></svg>
          Ajouter un produit
        </button>
      </div>

      <div class="table">
        <table>
          <thead>
            <tr>
              <th scope="col">Produit</th>
              <th scope="col">État</th>
              <th scope="col">Langue</th>
              <th scope="col" class="number">Price Trend</th>
              <th scope="col">Quantité</th>
              <th scope="col">Coût unitaire (€)</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (line of lines(); track line.key) {
              <tr>
                <td>
                  <span class="product">
                    <span class="card-thumb">
                      @if (line.item.product.imageUrl; as imageUrl) {
                        <img
                          [src]="imageUrl"
                          alt=""
                          loading="lazy"
                          (error)="hideBrokenImage($event)"
                        />
                      }
                    </span>
                    <span class="identity">
                      <strong>{{ cardName(line.item.product) }}</strong>
                      <span>{{ productDetails(line.item.product) }}</span>
                    </span>
                  </span>
                </td>
                <td><app-item-state [item]="state(line.item)" /></td>
                <td>
                  @if (line.item.language; as language) {
                    <app-chip
                      [text]="flags[language]"
                      [tooltip]="languages[language]"
                      tone="flag"
                    />
                  }
                </td>
                <td class="number">{{ formatPrice(unitPrice(line.item)) }}</td>
                <td>
                  <input
                    class="quantity"
                    type="number"
                    min="1"
                    max="100"
                    required
                    [value]="line.quantity"
                    [attr.aria-label]="'Quantité de ' + name(line)"
                    (input)="
                      update(line, { quantity: +$any($event.target).value })
                    "
                  />
                </td>
                <td>
                  <input
                    class="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Auto"
                    [value]="line.unitCost ?? ''"
                    [attr.aria-label]="'Coût unitaire de ' + name(line)"
                    (input)="update(line, { unitCost: cost($event) })"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    class="icon-button discard"
                    [title]="'Retirer ' + name(line)"
                    [attr.aria-label]="'Retirer ' + name(line)"
                    (click)="removeLine(line)"
                  >
                    <svg lucideTrash2 [size]="16" aria-hidden="true"></svg>
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td class="empty" colspan="7">
                  Ajoutez les produits de l’achat : ils entreront au stock à
                  l’enregistrement.
                </td>
              </tr>
            }
          </tbody>
          @if (lines().length > 0) {
            <tfoot>
              <tr>
                <td colspan="3">{{ itemCount() }} exemplaires</td>
                <td class="number">{{ formatPrice(marketValue()) }}</td>
                <td colspan="3" class="number">
                  Coût total : {{ formatPrice(totalCost()) }}
                </td>
              </tr>
            </tfoot>
          }
        </table>
      </div>

      <p class="hint">
        Sans coût unitaire, chaque exemplaire reçoit une part du reste du prix,
        frais compris, au prorata de son Price Trend Cardmarket ; un exemplaire
        sans prix compte pour la moyenne des autres.
      </p>

      @if (itemCount() > maxItems) {
        <p class="error" role="alert">
          Un achat compte {{ maxItems }} exemplaires au plus.
        </p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      <footer>
        <button
          class="small-button submit"
          [disabled]="
            saving() || lines().length === 0 || itemCount() > maxItems
          "
        >
          {{ saving() ? 'Enregistrement…' : 'Enregistrer l’achat' }}
        </button>
      </footer>
    </form>

    @if (picking() && current(); as organization) {
      <app-inventory-add
        [organizationId]="organization.id"
        [forPurchase]="true"
        (picked)="addLine($event)"
        (closed)="picking.set(false)"
      />
    }
  `,
  styleUrl: './purchases.css',
  styles: `
    form {
      display: grid;
      gap: 1rem;
    }

    .details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 0.75rem;
      max-width: 56rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .details .wide {
      grid-column: 1 / -1;
    }

    label {
      display: grid;
      gap: 0.25rem;
      color: var(--slate);
      font-size: 0.85rem;
    }

    input,
    textarea {
      min-width: 0;
      padding: 0.45rem 0.6rem;
      color: var(--ink);
      font-size: 1rem;
    }

    textarea {
      border: 2px solid var(--rule);
      border-radius: 0.5rem;
      background: var(--surface);
      font: inherit;
      resize: vertical;
    }

    .section-header {
      margin: 0.5rem 0 0;
    }

    .quantity {
      width: 5rem;
    }

    .cost {
      width: 8rem;
    }

    footer {
      display: flex;
      justify-content: flex-end;
    }

    .submit {
      padding: 0.65rem 1rem;
      font-size: 1rem;
    }

    .submit:disabled {
      background: var(--slate);
      cursor: not-allowed;
    }
  `,
})
export class PurchaseNew {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly current = inject(Organizations).current;
  readonly cardName = cardName;
  readonly productDetails = productDetails;
  readonly formatPrice = formatPrice;
  readonly hideBrokenImage = hideBrokenImage;
  readonly unitPrice = unitPrice;
  readonly flags = LANGUAGE_FLAGS;
  readonly languages = LANGUAGES;
  readonly maxItems = MAX_ITEMS;
  readonly today = today();
  readonly picking = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly price = signal(0);
  readonly fees = signal(0);
  readonly lines = signal<DraftLine[]>([]);
  private nextKey = 0;

  readonly itemCount = computed(() =>
    this.lines().reduce((count, line) => count + line.quantity, 0),
  );
  readonly marketValue = computed(() =>
    this.lines().reduce(
      (total, line) => total + (unitPrice(line.item) ?? 0) * line.quantity,
      0,
    ),
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
    const { supplier, purchasedAt, price, fees, notes } = formValues(
      event,
    ) as Record<string, string>;
    const organization = this.current();
    if (!organization) return;
    this.error.set('');
    this.saving.set(true);
    this.http
      .post<PurchaseDetail>(`/api/organizations/${organization.id}/purchases`, {
        supplier,
        purchasedAt,
        price: Number(price),
        fees: Number(fees || 0),
        ...(notes && { notes }),
        lines: this.lines().map(({ item, quantity, unitCost }) => ({
          productId: item.product.id,
          condition: item.condition,
          language: item.language,
          gradingCompany: item.gradingCompany,
          grade: item.grade,
          reverse: item.reverse,
          quantity,
          ...(unitCost !== null && { unitCost }),
        })),
      })
      .subscribe({
        next: (purchase) =>
          void this.router.navigate(['/app/purchases', purchase.id]),
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(errorMessage(error));
        },
      });
  }
}
