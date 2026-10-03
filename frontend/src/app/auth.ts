import {
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap, tap, throwError } from 'rxjs';

export interface User {
  id: string;
  username: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  readonly user = signal<User | null>(null);

  signup(form: object) {
    return this.http.post('/api/auth/signup', form);
  }

  login(form: object) {
    return this.http.post('/api/auth/login', form);
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
  return inject(Auth)
    .loadUser()
    .pipe(
      map(() => true),
      catchError(() => of(router.parseUrl('/login'))),
    );
};

export function errorMessage(error: HttpErrorResponse): string {
  const message = (error.error as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join('. ');
  return typeof message === 'string' ? message : 'Une erreur est survenue.';
}

export function formValues(event: SubmitEvent): object {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.target as HTMLFormElement));
}
