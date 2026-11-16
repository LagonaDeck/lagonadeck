import { formatTimestamp } from '../utils/format.util';

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

export interface PricePoint {
  date: string;
  trend: string | null;
  low: string | null;
}

export type PriceDirection = 'up' | 'down' | 'stable';

export const PRICE_DIRECTIONS: Record<PriceDirection, string> = {
  up: 'En hausse',
  down: 'En baisse',
  stable: 'Stable',
};

export const PRODUCT_SOURCES: Record<string, string> = {
  TCGDEX: 'TCGdex',
  CARDMARKET: 'Cardmarket',
  MANUAL: 'Saisie manuelle',
};

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

/** « Pingoléon FB (SV 27) » : le set et le numéro identifient la carte. */
export const cardName = (
  product: Pick<Product, 'name' | 'setCode' | 'cardNumber'>,
): string => {
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
    ? `Price Trend Cardmarket du ${formatTimestamp(product.priceUpdatedAt)}`
    : 'Aucun prix : produit non lié à Cardmarket';
