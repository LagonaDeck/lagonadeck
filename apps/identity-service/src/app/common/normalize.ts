/**
 * Normalisation partagée par les DTOs (`@Transform`) et par `UserService`
 * (ex. `findByEmail`, qui reçoit une valeur brute plutôt qu'un DTO). Garder
 * une seule implémentation évite que les deux chemins divergent silencieusement.
 */

/** email/pseudo sont comparés/stockés insensibles à la casse et sans espaces superflus. */
export function normalizeEmail(value: string): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function normalizePseudo(value: string): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
