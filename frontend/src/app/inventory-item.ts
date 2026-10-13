import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideTrendingDown,
  LucideTrendingUp,
} from '@lucide/angular';
import { Auth, errorMessage } from './auth';
import {
  CardmarketPrices,
  InventoryItem,
  cardName,
  formatPrice,
  hideBrokenImage,
  itemValueTitle,
  LANGUAGES,
  LANGUAGE_FLAGS,
  productDetails,
} from './catalog';
import { Chip } from './chip';
import { ItemState } from './item-state';
import { Organizations } from './organizations';
import { PriceAveragesChart } from './price-averages-chart';
import { PriceHistoryChart, PricePoint } from './price-history-chart';

const SOURCES: Record<string, string> = {
  TCGDEX: 'TCGdex',
  CARDMARKET: 'Cardmarket',
  MANUAL: 'Saisie manuelle',
};

// Écart entre les moyennes 7 et 30 jours en dessous duquel le prix est stable.
const STABLE_RATIO = 0.02;

// Inclinaison en degrés entre les deux bords de la carte.
const TILT_RANGE = 16;

type Direction = 'up' | 'down' | 'stable';

const DIRECTIONS: Record<Direction, string> = {
  up: 'En hausse',
  down: 'En baisse',
  stable: 'Stable',
};

@Component({
  selector: 'app-inventory-item',
  imports: [
    LucideArrowLeft,
    LucideTrendingDown,
    LucideTrendingUp,
    Chip,
    ItemState,
    PriceAveragesChart,
    PriceHistoryChart,
    RouterLink,
  ],
  template: `
    <a class="back" routerLink="/app/inventory">
      <svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>
      Inventaire
    </a>

    @if (item.value(); as item) {
      <article class="hero">
        <figure
          class="card-image"
          (pointermove)="tilt($event)"
          (pointerleave)="untilt($event)"
        >
          @if (item.product.imageUrl; as imageUrl) {
            <img
              [src]="imageUrl"
              [alt]="cardName(item.product)"
              (error)="hideBrokenImage($event)"
            />
          } @else {
            <div class="no-image">Pas d’image</div>
          }
        </figure>

        <div class="identity">
          <h1>{{ item.product.name }}</h1>
          <p class="subtitle">{{ productDetails(item.product) }}</p>

          <dl class="facts">
            @if (item.product.setCode || item.product.cardNumber) {
              <div>
                <dt>Référence</dt>
                <dd>
                  {{ item.product.setCode }} {{ item.product.cardNumber }}
                </dd>
              </div>
            }
            @if (item.product.rarity) {
              <div>
                <dt>Rareté</dt>
                <dd>{{ item.product.rarity }}</dd>
              </div>
            }
            <div>
              <dt>Source</dt>
              <dd>{{ sources[item.product.source] }}</dd>
            </div>
            @if (item.product.moves.length > 0) {
              <div class="wide">
                <dt>Talents et attaques</dt>
                <dd>
                  <ul class="moves">
                    @for (move of item.product.moves; track move) {
                      <li>{{ move }}</li>
                    }
                  </ul>
                </dd>
              </div>
            }
          </dl>

          <div class="quote">
            @if (item.product.cardmarket; as cardmarket) {
              <p class="price">
                {{
                  formatPrice(
                    item.reverse ? cardmarket.trendHolo : cardmarket.trend
                  )
                }}
              </p>
              <p class="price-note">
                Price Trend Cardmarket{{ item.reverse ? ' de la reverse' : '' }}
                @if (cardmarket.priceDate) {
                  du {{ date(cardmarket.priceDate) }}
                }
                @if (!item.reverse && direction(cardmarket); as direction) {
                  <span class="direction {{ direction }}">
                    @switch (direction) {
                      @case ('up') {
                        <svg
                          lucideTrendingUp
                          [size]="16"
                          aria-hidden="true"
                        ></svg>
                      }
                      @case ('down') {
                        <svg
                          lucideTrendingDown
                          [size]="16"
                          aria-hidden="true"
                        ></svg>
                      }
                    }
                    {{ directions[direction] }} sur 7 jours
                  </span>
                }
              </p>
            } @else {
              <p class="price-note">
                Pas de prix : ce produit n’est lié à aucun produit Cardmarket.
              </p>
            }
          </div>

          <dl class="stock">
            <div>
              <dt>{{ item.gradingCompany ? 'Gradation' : 'État' }}</dt>
              <dd><app-item-state [item]="item" /></dd>
            </div>
            <div>
              <dt>Langue</dt>
              <dd>
                @if (item.language; as language) {
                  <app-chip
                    [text]="flags[language]"
                    [tooltip]="languages[language]"
                    tone="flag"
                  />
                } @else {
                  —
                }
              </dd>
            </div>
            <div>
              <dt>Valeur</dt>
              <dd [title]="itemValueTitle(item)">
                {{ formatPrice(item.price) }}
              </dd>
            </div>
          </dl>
          <p class="hint">
            Dans le stock depuis le {{ date(item.createdAt) }}.
          </p>
        </div>
      </article>

      @if (item.product.cardmarket; as cardmarket) {
        <section class="market">
          <div class="chart history">
            <h2>Évolution du prix</h2>
            @if (history.value(); as points) {
              <app-price-history-chart [points]="points" />
            } @else if (history.error()) {
              <p class="error" role="alert">
                L’historique des prix n’a pas pu être chargé.
              </p>
            }
          </div>
          <div class="chart">
            <h2>Prix du jour</h2>
            <app-price-averages-chart [prices]="cardmarket" />
            @if (item.reverse) {
              <p class="hint">
                Cardmarket ne donne que la tendance de la reverse : la courbe et
                les moyennes sont celles de la version normale.
              </p>
            } @else if (
              item.product.hasReverse !== false && cardmarket.trendHolo
            ) {
              <p class="hint">
                Version reverse : {{ formatPrice(cardmarket.trendHolo) }}
              </p>
            }
          </div>
          <p class="hint source">
            Produit Cardmarket n° {{ cardmarket.id }}, {{ cardmarket.name
            }}{{
              item.product.cardmarketLinkedByUser ? ', lié à la main' : ''
            }}. Une référence pour une carte brute, sans tenir compte de l’état
            ni de la langue.
          </p>
        </section>
      }

      <div class="columns">
        <section>
          <h2>Achat</h2>
          <p class="hint">
            Le lot ou l’achat d’origine s’affichera ici avec le module des
            achats.
          </p>
        </section>

        @if (auth.catalogStaff()) {
          <section>
            <h2>Lien Cardmarket</h2>
            <form class="link-form" (submit)="link($event, item.product.id)">
              <label>
                Identifiant Cardmarket
                <input
                  name="cardmarketId"
                  type="number"
                  min="1"
                  placeholder="idProduct"
                  required
                />
              </label>
              <button class="small-button">Lier</button>
              @if (item.product.cardmarket) {
                <button
                  type="button"
                  class="link-button"
                  (click)="unlink(item.product.id)"
                >
                  Retirer le lien
                </button>
              }
            </form>
            @if (linkError()) {
              <p class="error" role="alert">{{ linkError() }}</p>
            }
          </section>
        } @else {
          <section>
            <h2>Un problème sur ce produit ?</h2>
            @if (reported()) {
              <p class="success" role="status">
                Merci : l’équipe LagonaDeck va vérifier ce produit.
              </p>
            } @else {
              <p class="hint">
                Prix, lien Cardmarket ou informations faux : le catalogue est
                partagé, l’équipe LagonaDeck le corrige pour tout le monde.
              </p>
              <form
                class="report-form"
                (submit)="report($event, item.product.id)"
              >
                <textarea
                  name="message"
                  rows="3"
                  maxlength="1000"
                  required
                  aria-label="Problème constaté"
                  placeholder="Ex. le prix est celui de la version reverse"
                ></textarea>
                <button class="small-button">Signaler</button>
              </form>
              @if (reportError()) {
                <p class="error" role="alert">{{ reportError() }}</p>
              }
            }
          </section>
        }
      </div>
    } @else if (item.error()) {
      <p class="error" role="alert">
        Ce produit n’est pas dans le stock de l’organisation sélectionnée.
      </p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 2rem;
      max-width: 68rem;
    }

    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      justify-self: start;
      color: var(--slate);
      font-size: 0.9rem;
      text-decoration: none;
    }

    .back:hover {
      color: var(--blue);
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(14rem, 22rem) minmax(0, 1fr);
      gap: 2.5rem;
      align-items: start;
    }

    .card-image {
      margin: 0;
      perspective: 60rem;
    }

    .card-image img,
    .no-image {
      display: grid;
      place-items: center;
      width: 100%;
      aspect-ratio: 63 / 88;
      border-radius: 4.5% / 3.2%;
      object-fit: cover;
      background: var(--hover);
      box-shadow: 0 24px 40px -24px var(--shadow);
      color: var(--slate);
      font-size: 0.85rem;
    }

    .card-image img {
      transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
      transition:
        transform 0.5s ease-out,
        box-shadow 0.5s ease-out;
    }

    .card-image:hover img {
      transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))
        scale(1.03);
      box-shadow: 0 36px 48px -24px var(--shadow);
      transition-duration: 0.12s;
    }

    @media (prefers-reduced-motion: reduce) {
      .card-image img,
      .card-image:hover img {
        transform: none;
        transition: none;
      }
    }

    .identity {
      display: grid;
      gap: 1.25rem;
      padding-top: 0.5rem;
    }

    h1 {
      font-size: clamp(2rem, 5vw, 3.25rem);
      line-height: 1;
      text-wrap: balance;
    }

    .subtitle {
      margin-top: -0.75rem;
      color: var(--slate);
    }

    .facts,
    .stock {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 2rem;
      margin: 0;
    }

    .facts .wide {
      flex-basis: 100%;
    }

    dt {
      color: var(--slate);
      font-size: 0.8rem;
    }

    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }

    .moves {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin: 0.2rem 0 0;
      padding: 0;
      list-style: none;
    }

    .moves li {
      padding: 0.1rem 0.6rem;
      border: 1px solid var(--rule);
      border-radius: 999px;
      font-size: 0.85rem;
    }

    .quote {
      padding-top: 1.25rem;
      border-top: 1px solid var(--rule);
    }

    .price {
      font-family: var(--font-display);
      font-size: clamp(2.75rem, 7vw, 4rem);
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: proportional-nums;
    }

    .price-note {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 1rem;
      margin-top: 0.4rem;
      color: var(--slate);
      font-size: 0.9rem;
    }

    .direction {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-weight: 700;
    }

    .direction.up {
      color: var(--success);
    }

    .direction.down {
      color: var(--danger);
    }

    .stock {
      padding: 0.9rem 1.1rem;
      border-radius: 0.75rem;
      background: var(--hover);
    }

    .stock dd {
      font-weight: 700;
    }

    .stock + .hint {
      margin-top: -0.75rem;
      font-size: 0.85rem;
    }

    .market {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
      gap: 1.5rem 2.5rem;
      padding: 1.5rem;
      border: 1px solid var(--rule);
      border-radius: 1rem;
      background: var(--surface);
    }

    .chart {
      display: grid;
      align-content: start;
      gap: 0.9rem;
      min-width: 0;
    }

    h2 {
      font-size: 1.3rem;
    }

    .source {
      grid-column: 1 / -1;
      font-size: 0.85rem;
    }

    .columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      gap: 2rem 2.5rem;
      align-items: start;
    }

    .columns section {
      display: grid;
      gap: 0.6rem;
    }

    .link-form {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
    }

    .link-form label {
      display: grid;
      gap: 0.25rem;
      color: var(--slate);
      font-size: 0.85rem;
    }

    .link-form input {
      width: 10rem;
      padding: 0.45rem 0.6rem;
    }

    .report-form {
      display: grid;
      justify-items: start;
      gap: 0.6rem;
    }

    .report-form textarea {
      width: 100%;
      padding: 0.5rem 0.7rem;
      border: 2px solid var(--rule);
      border-radius: 0.5rem;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      resize: vertical;
    }

    @media (max-width: 56rem) {
      .market {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    @media (max-width: 40rem) {
      .hero {
        grid-template-columns: minmax(0, 1fr);
        gap: 1.5rem;
      }

      .card-image {
        width: min(15rem, 70%);
      }

      .market {
        padding: 1rem;
      }
    }
  `,
})
export class InventoryItemPage {
  private readonly http = inject(HttpClient);
  private readonly current = inject(Organizations).current;
  readonly itemId = input.required<string>();
  readonly sources = SOURCES;
  readonly directions = DIRECTIONS;
  readonly cardName = cardName;
  readonly productDetails = productDetails;
  readonly formatPrice = formatPrice;
  readonly hideBrokenImage = hideBrokenImage;
  readonly flags = LANGUAGE_FLAGS;
  readonly languages = LANGUAGES;
  readonly itemValueTitle = itemValueTitle;
  readonly linkError = signal('');
  readonly reportError = signal('');
  readonly reported = signal(false);
  readonly auth = inject(Auth);

  private readonly base = computed(() => {
    const organization = this.current();
    return organization && `/api/organizations/${organization.id}`;
  });
  readonly item = httpResource<InventoryItem>(() =>
    this.base() ? `${this.base()}/inventory/${this.itemId()}` : undefined,
  );
  readonly history = httpResource<PricePoint[]>(() => {
    const product = this.item.value()?.product;
    return product?.cardmarket
      ? `/api/products/${product.id}/price-history`
      : undefined;
  });

  // La moyenne 7 jours comparée à la moyenne 30 jours, comme sur Cardmarket.
  direction(cardmarket: CardmarketPrices): Direction | null {
    if (!cardmarket.avg7 || !cardmarket.avg30) return null;
    const change = Number(cardmarket.avg7) / Number(cardmarket.avg30) - 1;
    if (change > STABLE_RATIO) return 'up';
    if (change < -STABLE_RATIO) return 'down';
    return 'stable';
  }

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
    this.http.post('/api/products/reports', { productId, message }).subscribe({
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

  date(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-CH');
  }

  private saveLink(
    productId: string,
    cardmarketId: number | null,
    done?: () => void,
  ): void {
    this.linkError.set('');
    this.http
      .put(`/api/products/${productId}/cardmarket`, { cardmarketId })
      .subscribe({
        next: () => {
          done?.();
          this.item.reload();
        },
        error: (error: HttpErrorResponse) =>
          this.linkError.set(errorMessage(error)),
      });
  }
}
