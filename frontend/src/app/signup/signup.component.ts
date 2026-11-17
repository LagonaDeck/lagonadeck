import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { errorMessage, formValues } from '../utils/form.util';

@Component({
  selector: 'app-signup',
  imports: [RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: '../styles/auth.css',
})
export class SignupComponent {
  private readonly auth = inject(AuthService);
  // Pré-remplie par le lien d'un e-mail d'invitation. Sans `?email=`, le router
  // passe `undefined`, qui remplace la valeur par défaut.
  readonly email = input('', {
    transform: (email: string | undefined) => email ?? '',
  });
  readonly sentTo = signal('');
  readonly error = signal('');
  readonly pending = signal(false);
  readonly username = signal('');
  readonly memberSince = new Intl.DateTimeFormat('fr-CH', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  submit(event: SubmitEvent): void {
    this.pending.set(true);
    const form = formValues(event) as { email: string };
    this.auth.signup(form).subscribe({
      next: () => this.sentTo.set(form.email),
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
