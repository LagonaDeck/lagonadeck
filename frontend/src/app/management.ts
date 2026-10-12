import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { errorMessage } from './auth';
import {
  Product,
  cardName,
  formatPrice,
  hideBrokenImage,
  productDetails,
} from './catalog';

interface Report {
  id: string;
  product: Product | null;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt: string | null;
}

// Section réservée à l'équipe LagonaDeck : l'API refuse ces routes aux autres
// utilisateurs.
@Component({
  selector: 'app-management',
  template: `
    <p class="eyebrow">Gestion LagonaDeck</p>
    <div class="page-header">
      <h1>Signalements cartes incomplètes</h1>
      <div class="tabs" role="group" aria-label="Signalements affichés">
        <button
          type="button"
          [attr.aria-pressed]="status() === 'OPEN'"
          (click)="status.set('OPEN')"
        >
          À traiter
        </button>
        <button
          type="button"
          [attr.aria-pressed]="status() === 'RESOLVED'"
          (click)="status.set('RESOLVED')"
        >
          Traités
        </button>
      </div>
    </div>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <ul class="reports">
      @for (report of reports.value() ?? []; track report.id) {
        <li class="panel">
          @if (report.product; as product) {
            <div class="product">
              <span class="card-thumb">
                @if (product.imageUrl) {
                  <img
                    [src]="product.imageUrl"
                    alt=""
                    loading="lazy"
                    (error)="hideBrokenImage($event)"
                  />
                }
              </span>
              <span class="identity">
                <strong>{{ cardName(product) }}</strong>
                <span>{{ productDetails(product) }}</span>
                <span>
                  @if (product.cardmarket; as cardmarket) {
                    Cardmarket n° {{ cardmarket.id }} :
                    {{ formatPrice(cardmarket.trend) }}
                  } @else {
                    Aucun lien Cardmarket
                  }
                </span>
              </span>
            </div>
          } @else {
            <strong>Produit manquant</strong>
          }
          <blockquote>{{ report.message }}</blockquote>
          <p class="hint">
            Signalé le {{ date(report.createdAt) }}
            @if (report.resolvedAt) {
              · traité le {{ date(report.resolvedAt) }}
            }
          </p>

          <div class="actions">
            @if (report.product && report.status === 'OPEN') {
              <form (submit)="link($event, report.product.id)">
                <input
                  name="cardmarketId"
                  type="number"
                  min="1"
                  placeholder="idProduct Cardmarket"
                  aria-label="Identifiant Cardmarket"
                  required
                />
                <button class="small-button">Lier</button>
              </form>
            }
            @if (report.status === 'OPEN') {
              <button
                type="button"
                class="link-button"
                (click)="setStatus(report, 'RESOLVED')"
              >
                Marquer comme traité
              </button>
            } @else {
              <button
                type="button"
                class="link-button"
                (click)="setStatus(report, 'OPEN')"
              >
                Rouvrir
              </button>
            }
          </div>
        </li>
      } @empty {
        <li class="hint">
          {{ reports.isLoading() ? 'Chargement…' : 'Aucun signalement.' }}
        </li>
      }
    </ul>
    <p class="hint">
      Un produit manquant se crée depuis « Ajouter au stock », dans
      l’inventaire.
    </p>
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
      max-width: 48rem;
    }

    .eyebrow {
      margin-bottom: -0.75rem;
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

    h1 {
      font-size: clamp(1.75rem, 3vw, 2.25rem);
    }

    .tabs {
      display: flex;
      gap: 0.25rem;
      padding: 0.2rem;
      border: 1px solid var(--rule);
      border-radius: 0.6rem;
    }

    .tabs button {
      padding: 0.35rem 0.8rem;
      border: 0;
      border-radius: 0.45rem;
      background: none;
      color: var(--slate);
      font: inherit;
      cursor: pointer;
    }

    .tabs [aria-pressed='true'] {
      background: var(--hover);
      color: var(--ink);
      font-weight: 700;
    }

    .reports {
      display: grid;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .panel {
      display: grid;
      gap: 0.6rem;
      padding: 1rem 1.25rem;
      border: 1px solid var(--rule);
      border-radius: 0.75rem;
      background: var(--surface);
    }

    .product {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .identity {
      display: grid;
      min-width: 0;
    }

    .identity span {
      color: var(--slate);
      font-size: 0.85rem;
    }

    blockquote {
      margin: 0;
      padding-left: 0.75rem;
      border-left: 3px solid var(--rule);
      white-space: pre-line;
    }

    .actions,
    .actions form {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    .actions input {
      width: 12rem;
      padding: 0.4rem 0.6rem;
    }
  `,
})
export class Management {
  private readonly http = inject(HttpClient);
  readonly status = signal<'OPEN' | 'RESOLVED'>('OPEN');
  readonly error = signal('');
  readonly cardName = cardName;
  readonly productDetails = productDetails;
  readonly formatPrice = formatPrice;
  readonly hideBrokenImage = hideBrokenImage;

  readonly reports = httpResource<Report[]>(() => ({
    url: '/api/products/reports',
    params: { status: this.status() },
  }));

  link(event: SubmitEvent, productId: string): void {
    event.preventDefault();
    const cardmarketId = Number(
      new FormData(event.target as HTMLFormElement).get('cardmarketId'),
    );
    this.run(
      this.http.put(`/api/products/${productId}/cardmarket`, { cardmarketId }),
    );
  }

  setStatus(report: Report, status: Report['status']): void {
    this.run(this.http.patch(`/api/products/reports/${report.id}`, { status }));
  }

  date(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-CH');
  }

  private run(request: Observable<unknown>): void {
    this.error.set('');
    request.subscribe({
      next: () => this.reports.reload(),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
