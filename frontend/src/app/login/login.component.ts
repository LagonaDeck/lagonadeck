import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { errorMessage, formValues } from '../utils/form.util';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.component.html',
  styleUrl: '../styles/auth.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly pending = signal(false);
  readonly unconfirmedEmail = signal('');
  readonly resent = signal(false);

  submit(event: SubmitEvent): void {
    this.pending.set(true);
    const form = formValues(event) as { email: string };
    this.auth.login(form).subscribe({
      next: () => void this.router.navigate(['/app']),
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
        // 403 : identifiants corrects, adresse pas encore confirmée.
        this.unconfirmedEmail.set(error.status === 403 ? form.email : '');
        this.resent.set(false);
      },
    });
  }

  resend(): void {
    this.auth
      .resendConfirmation(this.unconfirmedEmail())
      .subscribe(() => this.resent.set(true));
  }
}
