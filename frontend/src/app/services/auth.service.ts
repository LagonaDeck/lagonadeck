import {
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { User } from '../models/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly user = signal<User | null>(null);
  // Équipe LagonaDeck : corrige le catalogue partagé par toutes les organisations.
  readonly catalogStaff = computed(
    () => this.user()?.staffPermissions.includes('CATALOG_MANAGE') ?? false,
  );

  signup(form: object) {
    return this.http.post('/api/auth/signup', form);
  }

  login(form: object) {
    return this.http.post('/api/auth/login', form);
  }

  confirmEmail(token: string) {
    return this.http.post<void>('/api/auth/confirm-email', { token });
  }

  resendConfirmation(email: string) {
    return this.http.post<void>('/api/auth/confirm-email/resend', { email });
  }

  logout() {
    return this.http
      .post('/api/auth/logout', null)
      .pipe(tap(() => this.user.set(null)));
  }

  loadUser() {
    return this.http
      .get<User>('/api/auth/me')
      .pipe(tap((user) => this.user.set(user)));
  }

  changePassword(passwords: { currentPassword: string; password: string }) {
    return this.http.put<void>('/api/auth/me/password', passwords);
  }

  updateProfile(form: object) {
    return this.http
      .patch<User>('/api/auth/me', form)
      .pipe(tap((user) => this.user.set(user)));
  }
}

// Ces routes ne dépendent pas du token de session : un 401 y est définitif.
const WITHOUT_SESSION = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/auth/confirm-email',
  '/api/auth/confirm-email/resend',
];

// Le token de session expire vite : sur un 401, on le renouvelle une fois
// avec le refresh token, puis on rejoue la requête.
export const refreshExpiredSession: HttpInterceptorFn = (request, next) => {
  const http = inject(HttpClient);
  return next(request).pipe(
    catchError((error: unknown) =>
      error instanceof HttpErrorResponse &&
      error.status === 401 &&
      !WITHOUT_SESSION.includes(request.url)
        ? http
            .post('/api/auth/refresh', null)
            .pipe(switchMap(() => next(request)))
        : throwError(() => error),
    ),
  );
};

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .loadUser()
    .pipe(
      map(() => true),
      catchError(() => of(router.parseUrl('/login'))),
    );
};
