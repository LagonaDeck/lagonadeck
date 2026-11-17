import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(error: HttpErrorResponse): string {
  const message = (error.error as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join('. ');
  return typeof message === 'string' ? message : 'Une erreur est survenue.';
}

export function formValues(event: SubmitEvent): object {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.target as HTMLFormElement));
}

export const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
