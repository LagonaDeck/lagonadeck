export interface CardmarketPrices {
  id: number;
  name: string;
  categoryName: string;
  trend: string | null;
  low: string | null;
  avg1: string | null;
  avg7: string | null;
  avg30: string | null;
  trendHolo: string | null;
  priceDate: string | null;
}

export interface Product {
  id: string;
  source: 'TCGDEX' | 'CARDMARKET' | 'MANUAL';
  productType: string;
  tcgdexId: string | null;
  name: string;
  englishName: string | null;
  setCode: string | null;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageUrl: string | null;
  /** `null` quand TCGdex ne liste pas les variantes de la carte. */
  hasReverse: boolean | null;
  moves: string[];
  cardmarket: CardmarketPrices | null;
  cardmarketLinkedByUser: boolean;
  price: string | null;
  priceUpdatedAt: string | null;
}

/** Un exemplaire du stock. */
export interface InventoryItem {
  id: string;
  condition: string | null;
  language: string | null;
  gradingCompany: string | null;
  grade: number | null;
  reverse: boolean;
  /** Prix unitaire de la ligne, celui de la reverse pour une reverse. */
  price: string | null;
  product: Product;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySummary {
  itemCount: number;
  value: string;
  unpricedItemCount: number;
}

export const PRODUCT_TYPES: Record<string, string> = {
  SINGLE: 'Cartes',
  BOOSTER: 'Booster',
  BOOSTER_DISPLAY: 'Display',
  ELITE_TRAINER_BOX: 'ETB',
  BOX_SET: 'Coffret',
  TIN: 'Tin',
  BUNDLE: 'Bundle',
  PRECONSTRUCTED_DECK: 'Deck préconstruit',
  OTHER: 'Autre',
};

// Libellés de Cardmarket, que les vendeurs connaissent.
export const CONDITIONS: Record<string, string> = {
  MINT: 'Mint',
  NEAR_MINT: 'Near Mint',
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  LIGHT_PLAYED: 'Light Played',
  PLAYED: 'Played',
  POOR: 'Poor',
};

export const CONDITION_CODES: Record<string, string> = {
  MINT: 'MT',
  NEAR_MINT: 'NM',
  EXCELLENT: 'EX',
  GOOD: 'GD',
  LIGHT_PLAYED: 'LP',
  PLAYED: 'PL',
  POOR: 'PO',
};

export const GRADING_COMPANIES: Record<string, string> = {
  PSA: 'PSA',
  BECKETT: 'Beckett',
  CGC: 'CGC',
  SGC: 'SGC',
  PCA: 'PCA',
};

// De 10 à 1 par demi-point, comme dans la validation de l'API.
export const GRADES = Array.from({ length: 19 }, (_, index) => 10 - index / 2);

export const LANGUAGES: Record<string, string> = {
  FRENCH: 'Français',
  ENGLISH: 'Anglais',
  JAPANESE: 'Japonais',
  GERMAN: 'Allemand',
  SPANISH: 'Espagnol',
  ITALIAN: 'Italien',
  PORTUGUESE: 'Portugais',
  KOREAN: 'Coréen',
  SIMPLIFIED_CHINESE: 'Chinois simplifié',
  TRADITIONAL_CHINESE: 'Chinois traditionnel',
  RUSSIAN: 'Russe',
};

// Drapeaux de Cardmarket : l'anglais sous le drapeau britannique, le chinois
// traditionnel sous celui de Taïwan.
export const LANGUAGE_FLAGS: Record<string, string> = {
  FRENCH: '🇫🇷',
  ENGLISH: '🇬🇧',
  JAPANESE: '🇯🇵',
  GERMAN: '🇩🇪',
  SPANISH: '🇪🇸',
  ITALIAN: '🇮🇹',
  PORTUGUESE: '🇵🇹',
  KOREAN: '🇰🇷',
  SIMPLIFIED_CHINESE: '🇨🇳',
  TRADITIONAL_CHINESE: '🇹🇼',
  RUSSIAN: '🇷🇺',
};

export const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const euros = new Intl.NumberFormat('fr-CH', {
  style: 'currency',
  currency: 'EUR',
});

export const formatPrice = (price: string | number | null): string =>
  price === null ? '—' : euros.format(Number(price));

/** « Pingoléon FB (SV 27) » : le set et le numéro identifient la carte. */
export const cardName = (product: Product): string => {
  const reference = [product.setCode, product.cardNumber]
    .filter(Boolean)
    .join(' ');
  return reference ? `${product.name} (${reference})` : product.name;
};

// Les cartes japonaises n'ont pas de nom anglais chez TCGdex : celui du produit
// Cardmarket lié, sans ses attaques (« Aerodactyl V [Bite | Rock Crush] »), les
// rend lisibles.
const englishName = (product: Product): string | null =>
  product.englishName ??
  product.cardmarket?.name.replace(/\s*\[[^\]]*\]$/, '') ??
  null;

/** « Vainqueurs Suprêmes - Empoleon FB - Cartes ». */
export const productDetails = (product: Product): string => {
  const english = englishName(product);
  return [
    product.setName,
    english !== product.name && english,
    PRODUCT_TYPES[product.productType],
  ]
    .filter(Boolean)
    .join(' - ');
};

export const priceTitle = (product: Product): string =>
  product.priceUpdatedAt
    ? `Price Trend Cardmarket du ${new Date(product.priceUpdatedAt).toLocaleDateString('fr-CH')}`
    : 'Aucun prix : produit non lié à Cardmarket';

// Le Price Trend Cardmarket vaut pour une carte brute, pas pour une carte gradée.
export const isGraded = (item: InventoryItem): boolean =>
  item.gradingCompany !== null;

export const itemValueTitle = (item: InventoryItem): string | null => {
  if (isGraded(item)) {
    return 'Non valorisée : le Price Trend Cardmarket vaut pour une carte brute';
  }
  if (item.reverse) return 'Price Trend Cardmarket de la version reverse';
  return null;
};

// Une image introuvable chez la source garde sa place, sans icône cassée.
export const hideBrokenImage = (event: Event): void => {
  (event.target as HTMLImageElement).style.visibility = 'hidden';
};
