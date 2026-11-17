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
import { errorMessage, formValues } from '../utils/form.util';
import { Organization } from '../models/organization';
import { OrganizationService } from '../services/organization.service';

@Component({
  selector: 'app-organization-create',
  imports: [LucideCheck, LucideX],
  templateUrl: './organization-create.component.html',
  styleUrl: './organization-create.component.css',
})
export class OrganizationCreateComponent {
  private readonly organizations = inject(OrganizationService);
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
