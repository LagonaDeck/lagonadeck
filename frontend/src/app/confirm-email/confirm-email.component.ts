import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { errorMessage } from '../utils/form.util';

@Component({
  selector: 'app-confirm-email',
  imports: [RouterLink],
  templateUrl: './confirm-email.component.html',
  styleUrl: '../styles/auth.css',
})
export class ConfirmEmailComponent implements OnInit {
  private readonly auth = inject(AuthService);
  readonly token = input('');
  readonly state = signal<'pending' | 'confirmed' | 'failed'>('pending');
  readonly error = signal('');

  ngOnInit(): void {
    this.auth.confirmEmail(this.token()).subscribe({
      next: () => this.state.set('confirmed'),
      error: (error: HttpErrorResponse) => {
        this.error.set(errorMessage(error));
        this.state.set('failed');
      },
    });
  }
}
