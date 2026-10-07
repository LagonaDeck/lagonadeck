import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucideX } from '@lucide/angular';
import { errorMessage, formValues } from './auth';
import { Organization, Organizations } from './organizations';

@Component({
  selector: 'app-organization-create',
  imports: [LucideCheck, LucideX],
  template: `
    <form class="settings" (submit)="create($event)">
      <div class="settings-row">
        <label for="new-organization-name">Nom</label>
        <span class="field">
          <input
            #field
            id="new-organization-name"
            name="name"
            required
            maxlength="100"
            placeholder="Boutique de Lausanne"
            (keydown.escape)="cancel($event)"
          />
          <span class="row-actions">
            <button
              class="icon-button confirm"
              title="Créer"
              aria-label="Créer l’organisation"
              [disabled]="pending()"
            >
              <svg lucideCheck [size]="18" aria-hidden="true"></svg>
            </button>
            <button
              type="button"
              class="icon-button discard"
              title="Annuler"
              aria-label="Annuler"
              (click)="cancel()"
            >
              <svg lucideX [size]="18" aria-hidden="true"></svg>
            </button>
          </span>
        </span>
      </div>
    </form>
    <p class="hint">Vous en serez le propriétaire.</p>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
  `,
  styles: `
    .field {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      min-width: 0;
    }

    input {
      flex: 0 1 16rem;
      min-width: 0;
      padding: 0.35rem 0.6rem;
    }

    .hint {
      margin-top: 0.75rem;
    }

    .error {
      max-width: 40rem;
      margin-top: 1rem;
    }
  `,
})
export class OrganizationCreate {
  private readonly organizations = inject(Organizations);
  readonly created = output<Organization>();
  readonly cancelled = output();
  readonly pending = signal(false);
  readonly error = signal('');
  private readonly field =
    viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    afterNextRender(() => this.field().nativeElement.focus());
  }

  // Échap annule la création sans fermer la modale qui contient la page.
  cancel(event?: Event): void {
    event?.preventDefault();
    this.cancelled.emit();
  }

  create(event: SubmitEvent): void {
    const { name } = formValues(event) as { name: string };
    this.pending.set(true);
    this.error.set('');
    this.organizations.create(name).subscribe({
      next: (organization) => this.created.emit(organization),
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
