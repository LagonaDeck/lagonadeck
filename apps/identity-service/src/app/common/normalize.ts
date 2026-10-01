/**
 * Normalisation partagée par les DTOs (`@Transform`) et par `UserService`
 * (ex. `findByEmail`, qui reçoit une valeur brute plutôt qu'un DTO). Garder
 * une seule implémentation évite que les deux chemins divergent silencieusement.
 */

/** Retire les espaces superflus ; laisse passer tel quel ce qui n'est pas une chaîne. */
export function trimString(value: string): string {
  return typeof value === 'string' ? value.trim() : value;
}

/** L'email est comparé et stocké insensible à la casse, sans espaces superflus. */
export function normalizeEmail(value: string): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/**
 * Clé de comparaison du pseudo (colonne `pseudoNormalized`, unique). Le pseudo
 * affiché garde la casse choisie par l'utilisateur : seule cette clé est en
 * minuscules.
 */
export function normalizePseudo(value: string): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
