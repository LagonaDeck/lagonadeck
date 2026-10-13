import {
  HttpClient,
  HttpErrorResponse,
  httpResource,
} from '@angular/common/http';
import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideArrowLeft, LucideSearch, LucideX } from '@lucide/angular';
import { Auth, errorMessage, formValues } from './auth';
import { Chip } from './chip';
import {
  CONDITIONS,
  CONDITION_CODES,
  GRADES,
  GRADING_COMPANIES,
  LANGUAGES,
  LANGUAGE_FLAGS,
  PRODUCT_TYPES,
  Product,
  cardName,
  formatPrice,
  hideBrokenImage,
  options,
  priceTitle,
  productDetails,
} from './catalog';

const SEARCH_DELAY_MS = 250;
const MIN_QUERY_LENGTH = 2;

/** Exemplaire choisi pour un achat : il n'entre au stock qu'avec l'achat. */
export interface PickedItem {
  product: Product;
  condition?: string;
  language?: string;
  gradingCompany?: string;
  grade?: number;
  reverse?: boolean;
}

/**
 * Modale d'ajout : chaque ajout crée un exemplaire du stock. Pour un achat
 * (`forPurchase`), l'exemplaire est seulement émis par `picked`, et la modale
 * reste ouverte pour les suivants.
 */
@Component({
  selector: 'app-inventory-add',
  host: { '(click)': 'closeOnBackdrop($event.target)' },
  imports: [Chip, LucideArrowLeft, LucideSearch, LucideX],
  template: `
    <dialog
      #dialog
      aria-labelledby="inventory-add-title"
      (close)="closed.emit()"
    >
      <header>
        <h2 id="inventory-add-title">{{ submitLabel() }}</h2>
        <button
          type="button"
          class="icon-button"
          title="Fermer"
          aria-label="Fermer"
          (click)="dialog.close()"
        >
          <svg lucideX [size]="18" aria-hidden="true"></svg>
        </button>
      </header>

      <div class="body" [class.picked]="selected()">
        <section class="finder" aria-label="Catalogue">
          @if (error() && !selected()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          @if (lastPicked()) {
            <p class="success" role="status">
              {{ lastPicked() }} est dans l’achat.
            </p>
          }
          @if (reporting()) {
            @if (reported()) {
              <p class="success" role="status">
                Merci : l’équipe LagonaDeck va ajouter ce produit au catalogue.
              </p>
              <button type="button" class="link-button" (click)="closeReport()">
                Revenir à la recherche
              </button>
            } @else {
              <p class="hint">
                Le catalogue est partagé par toutes les organisations : l’équipe
                LagonaDeck ajoute les produits manquants.
              </p>
              <form class="stack" (submit)="reportMissing($event)">
                <label>
                  Produit manquant
                  <textarea
                    name="message"
                    rows="3"
                    maxlength="1000"
                    required
                    placeholder="Nom, set et numéro, ex. Pikachu XY95"
                    >{{ query() }}</textarea>
                </label>
                <div class="actions">
                  <button class="small-button">Signaler</button>
                  <button
                    type="button"
                    class="link-button"
                    (click)="closeReport()"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            }
          } @else if (creating()) {
            <p class="hint">
              Le produit rejoint le catalogue partagé. Il n’a pas de prix tant
              qu’il n’est pas lié à Cardmarket, depuis sa fiche.
            </p>
            <form class="stack" (submit)="create($event)">
              <label>
                Nom
                <input name="name" [value]="query()" maxlength="200" required />
              </label>
              <div class="pair">
                <label>
                  Code du set
                  <input name="setCode" maxlength="20" placeholder="MEW" />
                </label>
                <label>
                  Numéro
                  <input name="cardNumber" maxlength="20" placeholder="006" />
                </label>
              </div>
              <div class="pair">
                <label>
                  Set
                  <input name="setName" maxlength="100" placeholder="151" />
                </label>
                <label>
                  Rareté
                  <input name="rarity" maxlength="50" placeholder="Rare" />
                </label>
              </div>
              <label>
                Type
                <select name="productType" required>
                  @for (option of productTypes; track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </label>
              <div class="actions">
                <button class="small-button">Créer</button>
                <button
                  type="button"
                  class="link-button"
                  (click)="creating.set(false)"
                >
                  Annuler
                </button>
              </div>
            </form>
          } @else {
            <div class="search-row">
              <label class="search">
                <svg lucideSearch [size]="18" aria-hidden="true"></svg>
                <input
                  type="search"
                  aria-label="Nom du produit"
                  placeholder="Nom, set ou numéro, ex. Dracaufeu MEW 006"
                  autocomplete="off"
                  autofocus
                  [value]="query()"
                  (input)="search($any($event.target).value)"
                />
              </label>
              <select
                aria-label="Type de produit"
                [value]="productType()"
                (change)="productType.set($any($event.target).value)"
              >
                <option value="">Tous les types</option>
                @for (option of productTypes; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </div>

            @if (query().length >= minQueryLength) {
              <ul class="results" aria-label="Produits du catalogue">
                @for (product of results.value() ?? []; track product.id) {
                  <li>
                    <button
                      type="button"
                      [attr.aria-pressed]="selected()?.id === product.id"
                      (click)="select(product)"
                    >
                      <span class="thumb">
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
                        <span>{{ details(product) }}</span>
                      </span>
                      <span class="price" [title]="priceTitle(product)">{{
                        formatPrice(product.price)
                      }}</span>
                    </button>
                  </li>
                } @empty {
                  <li class="hint">
                    {{
                      results.isLoading()
                        ? 'Recherche…'
                        : 'Aucun produit ne correspond.'
                    }}
                  </li>
                }
              </ul>
              <button
                type="button"
                class="link-button"
                (click)="
                  auth.catalogStaff() ? creating.set(true) : reporting.set(true)
                "
              >
                Produit absent du catalogue ?
                {{ auth.catalogStaff() ? 'Le créer' : 'Le signaler' }}
              </button>
            } @else {
              <p class="hint">
                Cherchez par nom, en français ou en anglais, par set ou par
                numéro.
              </p>
            }
          }
        </section>

        <section class="copy" aria-label="Exemplaire à ajouter">
          @if (selected(); as product) {
            <button type="button" class="back" (click)="select(null)">
              <svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>
              Résultats
            </button>

            <div class="specimen">
              <span class="card">
                @if (product.imageUrl) {
                  <img
                    [src]="product.imageUrl"
                    [alt]="cardName(product)"
                    (error)="hideBrokenImage($event)"
                  />
                }
              </span>
              <div class="specimen-text">
                <h3>{{ product.name }}</h3>
                <p class="reference">
                  {{ product.setCode }} {{ product.cardNumber }}
                </p>
                <p class="hint">{{ details(product) }}</p>
                <p class="price" [title]="priceTitle(product)">
                  {{ formatPrice(product.price) }}
                </p>
              </div>
            </div>

            <form (submit)="add($event, product)">
              @if (product.productType === 'SINGLE') {
                <fieldset class="choices">
                  <legend>Carte</legend>
                  <label>
                    <input
                      type="radio"
                      name="cardKind"
                      [checked]="!graded()"
                      (change)="graded.set(false)"
                    />
                    <span class="pill">Brute</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="cardKind"
                      [checked]="graded()"
                      (change)="graded.set(true)"
                    />
                    <span class="pill">Gradée</span>
                  </label>
                </fieldset>

                @if (graded()) {
                  <fieldset class="choices">
                    <legend>Société</legend>
                    @for (option of gradingCompanies; track option.value) {
                      <label>
                        <input
                          type="radio"
                          name="gradingCompany"
                          required
                          [value]="option.value"
                        />
                        <span class="pill">{{ option.label }}</span>
                      </label>
                    }
                  </fieldset>
                  <label class="row">
                    <span>Note</span>
                    <select name="grade" required>
                      @for (grade of grades; track grade) {
                        <option [value]="grade">{{ grade }}</option>
                      }
                    </select>
                  </label>
                } @else {
                  <fieldset class="choices tinted">
                    <legend>État</legend>
                    @for (option of conditions; track option.value) {
                      <label>
                        <input
                          type="radio"
                          name="condition"
                          required
                          [value]="option.value"
                          [attr.aria-label]="option.label"
                        />
                        <app-chip
                          [text]="conditionCodes[option.value]"
                          [tooltip]="option.label"
                          [tone]="option.value"
                        />
                      </label>
                    }
                  </fieldset>
                }
              }

              <fieldset class="choices tinted">
                <legend>Langue</legend>
                @for (option of languages; track option.value) {
                  <label>
                    <input
                      type="radio"
                      name="language"
                      required
                      [value]="option.value"
                      [attr.aria-label]="option.label"
                    />
                    <app-chip
                      [text]="flags[option.value]"
                      [tooltip]="option.label"
                      tone="flag"
                    />
                  </label>
                }
              </fieldset>

              @if (
                product.productType === 'SINGLE' && product.hasReverse !== false
              ) {
                <fieldset class="choices">
                  <legend>Variante</legend>
                  <label>
                    <input type="checkbox" name="reverse" value="true" />
                    <span class="pill">Reverse</span>
                  </label>
                </fieldset>
              }

              <footer>
                <button class="small-button submit">{{ submitLabel() }}</button>
                @if (error()) {
                  <p class="error" role="alert">{{ error() }}</p>
                }
              </footer>
            </form>
          } @else {
            <div class="placeholder">
              <span class="card"></span>
              <p class="hint">
                La carte choisie s’affiche ici, avec son état, sa langue et sa
                variante.
              </p>
            </div>
          }
        </section>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(64rem, calc(100% - 2rem));
      height: min(44rem, calc(100% - 2rem));
      max-width: none;
      max-height: none;
      padding: 0;
      border: 1px solid var(--rule);
      border-radius: 0.9rem;
      background: var(--surface);
      box-shadow: 0 30px 70px -30px var(--shadow);
      color: var(--ink);
      overflow: hidden;
    }

    dialog[open] {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }

    dialog::backdrop {
      background: rgb(15 21 53 / 0.55);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--rule);
    }

    h2 {
      font-size: 1.35rem;
    }

    .body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 27rem);
      min-height: 0;
    }

    .finder,
    .copy {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      min-height: 0;
      padding: 1.25rem;
      overflow-y: auto;
    }

    .copy {
      border-left: 1px solid var(--rule);
      background: var(--bg);
    }

    label {
      display: grid;
      gap: 0.25rem;
      color: var(--slate);
      font-size: 0.85rem;
    }

    input,
    select,
    textarea {
      min-width: 0;
      padding: 0.45rem 0.6rem;
      color: var(--ink);
      font-size: 1rem;
    }

    select,
    textarea {
      border: 2px solid var(--rule);
      border-radius: 0.5rem;
      background: var(--surface);
      font: inherit;
    }

    textarea {
      resize: vertical;
    }

    .stack {
      display: grid;
      gap: 0.75rem;
    }

    .pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .search-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .search {
      display: flex;
      flex: 1 1 16rem;
      align-items: center;
      gap: 0.5rem;
    }

    .search input {
      flex: 1;
    }

    .results {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .results button {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.5rem;
      border: 0;
      border-bottom: 1px solid var(--rule);
      border-radius: 0;
      background: none;
      color: var(--ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .results button:hover {
      background: var(--hover);
    }

    .results [aria-pressed='true'] {
      background: color-mix(in srgb, var(--blue) 10%, var(--surface));
      box-shadow: inset 3px 0 var(--blue);
    }

    .thumb {
      flex: none;
      width: 2.5rem;
      aspect-ratio: 63 / 88;
      border-radius: 0.2rem;
      background: var(--hover);
      overflow: hidden;
    }

    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .identity {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .identity span {
      color: var(--slate);
      font-size: 0.85rem;
      font-style: italic;
    }

    .price {
      flex: none;
      font-variant-numeric: tabular-nums;
    }

    .finder > .link-button {
      align-self: start;
    }

    .back {
      display: none;
    }

    .specimen {
      display: grid;
      grid-template-columns: 8.5rem minmax(0, 1fr);
      gap: 1.1rem;
      align-items: end;
    }

    .card {
      display: block;
      aspect-ratio: 63 / 88;
      border-radius: 4.5% / 3.2%;
      background: var(--hover);
      box-shadow: 0 18px 30px -18px var(--shadow);
      overflow: hidden;
    }

    .card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .specimen-text {
      display: grid;
      gap: 0.2rem;
    }

    h3 {
      font-size: 1.6rem;
      line-height: 1.05;
      text-wrap: balance;
    }

    .reference {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .specimen .price {
      margin-top: 0.35rem;
      font-family: var(--font-display);
      font-size: 1.35rem;
      font-weight: 700;
    }

    form {
      display: grid;
      gap: 0.9rem;
    }

    .choices {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .choices legend,
    .row > span {
      float: left;
      width: 5rem;
      padding: 0;
      color: var(--slate);
      font-size: 0.85rem;
    }

    .row {
      display: flex;
      align-items: center;
    }

    .choices label {
      position: relative;
      display: block;
      cursor: pointer;
    }

    /* Le bouton reste focusable et lisible par un lecteur d'écran. */
    .choices input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .pill {
      display: block;
      padding: 0.3rem 0.65rem;
      border: 1px solid var(--rule);
      border-radius: 0.4rem;
      background: var(--surface);
      color: var(--ink);
      font-size: 0.85rem;
    }

    .choices label:hover .pill {
      border-color: var(--slate);
    }

    .choices input:checked + .pill {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--surface);
      font-weight: 700;
    }

    /* États et drapeaux restent gris jusqu'au choix, qui prend sa couleur. */
    .tinted app-chip {
      padding: 0.3rem 0.45rem;
      font-size: 0.85rem;
      filter: grayscale(1);
      opacity: 0.55;
      outline: 2px solid transparent;
      outline-offset: 2px;
    }

    /* Un drapeau tout gris ne se reconnaît plus. */
    .tinted app-chip.flag {
      padding: 0.1rem 0.15rem;
      font-size: 1.4rem;
      filter: saturate(0.4);
    }

    .tinted label:hover app-chip,
    .tinted input:checked + app-chip {
      filter: none;
      opacity: 1;
    }

    .tinted input:checked + app-chip {
      outline-color: var(--ink);
    }

    .choices input:focus-visible + * {
      outline: 2px solid var(--blue);
      outline-offset: 2px;
    }

    footer {
      display: grid;
      gap: 0.6rem;
      margin-top: 0.4rem;
      padding-top: 1rem;
      border-top: 1px solid var(--rule);
    }

    .submit {
      justify-content: center;
      padding: 0.65rem 1rem;
      font-size: 1rem;
    }

    .placeholder {
      display: grid;
      flex: 1;
      align-content: center;
      justify-items: center;
      gap: 1rem;
      text-align: center;
    }

    .placeholder .card {
      width: 8.5rem;
      border: 2px dashed var(--rule);
      background: none;
      box-shadow: none;
    }

    .placeholder .hint {
      max-width: 18rem;
    }

    @media (max-width: 48rem) {
      dialog {
        width: 100%;
        height: 100%;
        border-radius: 0;
      }

      .body {
        grid-template-columns: minmax(0, 1fr);
      }

      .copy {
        border-left: 0;
      }

      .body.picked .finder,
      .body:not(.picked) .copy {
        display: none;
      }

      .back {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        align-self: start;
        padding: 0;
        border: 0;
        background: none;
        color: var(--slate);
        font: inherit;
        font-size: 0.9rem;
        cursor: pointer;
      }
    }
  `,
})
export class InventoryAdd {
  private readonly http = inject(HttpClient);
  readonly organizationId = input.required<string>();
  readonly forPurchase = input(false);
  readonly added = output();
  readonly picked = output<PickedItem>();
  readonly lastPicked = signal('');
  readonly submitLabel = computed(() =>
    this.forPurchase() ? 'Ajouter à l’achat' : 'Ajouter au stock',
  );
  readonly closed = output();
  readonly productTypes = options(PRODUCT_TYPES);
  readonly conditions = options(CONDITIONS);
  readonly conditionCodes = CONDITION_CODES;
  readonly languages = options(LANGUAGES);
  readonly flags = LANGUAGE_FLAGS;
  readonly gradingCompanies = options(GRADING_COMPANIES);
  readonly grades = GRADES;
  readonly graded = signal(false);
  readonly formatPrice = formatPrice;
  readonly priceTitle = priceTitle;
  readonly cardName = cardName;
  readonly details = productDetails;
  readonly hideBrokenImage = hideBrokenImage;
  readonly minQueryLength = MIN_QUERY_LENGTH;
  readonly query = signal('');
  readonly productType = signal('');
  readonly selected = signal<Product | null>(null);
  readonly creating = signal(false);
  readonly reporting = signal(false);
  readonly reported = signal(false);
  readonly auth = inject(Auth);
  readonly error = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;
  private readonly dialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly results = httpResource<Product[]>(() =>
    this.query().length >= MIN_QUERY_LENGTH
      ? {
          url: '/api/products',
          params: {
            search: this.query(),
            ...(this.productType() && { productType: this.productType() }),
          },
        }
      : undefined,
  );

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  // Échap ferme déjà un <dialog> natif ; le clic sur le fond en est l'équivalent à la souris.
  closeOnBackdrop(target: EventTarget | null): void {
    const dialog = this.dialog().nativeElement;
    if (target === dialog) dialog.close();
  }

  // Attend une courte pause dans la saisie avant d'interroger le serveur.
  search(value: string): void {
    this.lastPicked.set('');
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () => this.query.set(value.trim()),
      SEARCH_DELAY_MS,
    );
  }

  select(product: Product | null): void {
    this.graded.set(false);
    this.error.set('');
    this.selected.set(product);
  }

  reportMissing(event: SubmitEvent): void {
    this.error.set('');
    this.http.post('/api/products/reports', formValues(event)).subscribe({
      next: () => this.reported.set(true),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }

  closeReport(): void {
    this.reporting.set(false);
    this.reported.set(false);
  }

  create(event: SubmitEvent): void {
    this.error.set('');
    // Les champs facultatifs laissés vides ne sont pas envoyés.
    const values = Object.entries(formValues(event)).filter(
      ([, value]) => value !== '',
    );
    this.http
      .post<Product>('/api/products', Object.fromEntries(values))
      .subscribe({
        next: (product) => {
          this.creating.set(false);
          this.select(product);
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(errorMessage(error)),
      });
  }

  add(event: SubmitEvent, product: Product): void {
    const { condition, language, gradingCompany, grade, reverse } = formValues(
      event,
    ) as Record<string, string | undefined>;
    const item = {
      ...(condition && { condition }),
      ...(language && { language }),
      ...(gradingCompany && { gradingCompany, grade: Number(grade) }),
      ...(reverse && { reverse: true }),
    };
    if (this.forPurchase()) {
      this.picked.emit({ product, ...item });
      this.select(null);
      this.lastPicked.set(cardName(product));
      return;
    }
    this.error.set('');
    this.http
      .post(`/api/organizations/${this.organizationId()}/inventory`, {
        productId: product.id,
        ...item,
      })
      .subscribe({
        next: () => {
          this.added.emit();
          this.dialog().nativeElement.close();
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(errorMessage(error)),
      });
  }
}
