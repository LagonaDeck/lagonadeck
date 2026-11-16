import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucidePencil, LucideX } from '@lucide/angular';
import { AuthService } from '../services/auth.service';
import { errorMessage, formValues } from '../utils/form.util';

@Component({
  selector: 'app-security',
  imports: [LucideCheck, LucidePencil, LucideX],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css',
})
export class SecurityComponent {
  private readonly auth = inject(AuthService);
  readonly changing = signal(false);
  readonly pending = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  private readonly first = viewChild<ElementRef<HTMLInputElement>>('first');

  constructor() {
    effect(() => this.first()?.nativeElement.focus());
  }

  edit(): void {
    this.saved.set(false);
    this.error.set('');
    this.changing.set(true);
  }

  // Échap annule la saisie sans fermer la modale qui contient la page.
  cancel(event?: Event): void {
    event?.preventDefault();
    this.error.set('');
    this.changing.set(false);
  }

  changePassword(event: SubmitEvent): void {
    const { currentPassword, password, confirmation } = formValues(event) as {
      currentPassword: string;
      password: string;
      confirmation: string;
    };
    if (password !== confirmation) {
      this.error.set('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    this.pending.set(true);
    this.error.set('');
    this.auth.changePassword({ currentPassword, password }).subscribe({
      next: () => {
        this.pending.set(false);
        this.changing.set(false);
        this.saved.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
