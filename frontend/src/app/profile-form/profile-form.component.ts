import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucidePencil, LucideX } from '@lucide/angular';
import { AuthService } from '../services/auth.service';
import { errorMessage, formValues } from '../utils/form.util';

type Field = 'username' | 'email';

@Component({
  selector: 'app-profile-form',
  imports: [LucideCheck, LucidePencil, LucideX, NgTemplateOutlet],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.css',
})
export class ProfileFormComponent {
  readonly auth = inject(AuthService);
  readonly editing = signal<Field | null>(null);
  readonly error = signal('');
  readonly pending = signal(false);
  readonly initials = computed(() =>
    (this.auth.user()?.username ?? '').slice(0, 2).toUpperCase(),
  );
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => this.field()?.nativeElement.select());
  }

  edit(field: Field): void {
    this.error.set('');
    this.editing.set(field);
  }

  // Échap annule la modification sans fermer la modale qui contient la page.
  cancel(event?: Event): void {
    event?.preventDefault();
    this.error.set('');
    this.editing.set(null);
  }

  save(event: SubmitEvent): void {
    this.pending.set(true);
    this.auth.updateProfile(formValues(event)).subscribe({
      next: () => {
        this.pending.set(false);
        this.editing.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
