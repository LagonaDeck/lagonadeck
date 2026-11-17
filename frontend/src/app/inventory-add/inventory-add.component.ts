import { HttpErrorResponse } from '@angular/common/http';
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
import { AuthService } from '../services/auth.service';
import { CatalogService } from '../services/catalog.service';
import { InventoryService } from '../services/inventory.service';
import { errorMessage, formValues, options } from '../utils/form.util';
import { ChipComponent } from '../chip/chip.component';
import {
  CONDITIONS,
  CONDITION_CODES,
  GRADES,
  GRADING_COMPANIES,
  LANGUAGES,
  LANGUAGE_FLAGS,
} from '../models/inventory-item';
import {
  PRODUCT_TYPES,
  Product,
  cardName,
  priceTitle,
  productDetails,
} from '../models/product';
import { formatPrice, hideBrokenImage } from '../utils/format.util';
import { PickedItem } from '../models/purchase';

const SEARCH_DELAY_MS = 250;

/**
 * Modale d'ajout : chaque ajout crée un exemplaire du stock. Pour un achat
 * (`forPurchase`), l'exemplaire est seulement émis par `picked`, et la modale
 * reste ouverte pour les suivants.
 */
@Component({
  selector: 'app-inventory-add',
  host: { '(click)': 'closeOnBackdrop($event.target)' },
  imports: [ChipComponent, LucideArrowLeft, LucideSearch, LucideX],
  templateUrl: './inventory-add.component.html',
  styleUrl: './inventory-add.component.css',
})
export class InventoryAddComponent {
  private readonly inventoryService = inject(InventoryService);
  readonly catalogService = inject(CatalogService);
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
  readonly query = signal('');
  readonly productType = signal('');
  readonly selected = signal<Product | null>(null);
  readonly creating = signal(false);
  readonly reporting = signal(false);
  readonly reported = signal(false);
  readonly auth = inject(AuthService);
  readonly error = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;
  private readonly dialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly results = this.catalogService.search(this.query, this.productType);

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
    this.catalogService.report(formValues(event)).subscribe({
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
    this.catalogService.createProduct(formValues(event)).subscribe({
      next: (product) => {
        this.creating.set(false);
        this.select(product);
      },
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }

  add(event: SubmitEvent, product: Product): void {
    const item = this.inventoryService.itemFromForm(
      formValues(event) as Record<string, string | undefined>,
    );
    if (this.forPurchase()) {
      this.picked.emit({ product, ...item });
      this.select(null);
      this.lastPicked.set(cardName(product));
      return;
    }
    this.error.set('');
    this.inventoryService.add(product.id, item).subscribe({
      next: () => {
        this.added.emit();
        this.dialog().nativeElement.close();
      },
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
