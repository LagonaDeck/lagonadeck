import { Product } from './product';

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

/** Exemplaire à créer : une carte brute a un état, une gradée une note. */
export interface NewInventoryItem {
  condition?: string;
  language?: string;
  gradingCompany?: string;
  grade?: number;
  reverse?: boolean;
}

export interface InventorySummary {
  itemCount: number;
  value: string;
  unpricedItemCount: number;
}

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
