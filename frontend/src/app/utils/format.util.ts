const euros = new Intl.NumberFormat('fr-CH', {
  style: 'currency',
  currency: 'EUR',
});

export const formatPrice = (price: string | number | null): string =>
  price === null ? '—' : euros.format(Number(price));

// L'API renvoie une date sans heure : la lire en UTC garde le bon jour.
export const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString('fr-CH', { timeZone: 'UTC' });

// Un horodatage (`createdAt`…) donne le jour à l'heure locale de l'utilisateur.
export const formatTimestamp = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-CH');

export const formatCount = (value: number): string =>
  value.toLocaleString('fr-CH');

// Une image introuvable chez la source garde sa place, sans icône cassée.
export const hideBrokenImage = (event: Event): void => {
  (event.target as HTMLImageElement).style.visibility = 'hidden';
};
