import { NewInventoryItem } from './inventory-item';
import { PRODUCT_TYPES, Product } from './product';

export interface Purchase {
  id: string;
  supplier: string;
  purchasedAt: string;
  price: string;
  fees: string;
  /** Prix et frais : la somme des coûts des exemplaires. */
  totalCost: string;
  /** Price Trend des exemplaires le jour de l'achat, sans ceux sans prix. */
  marketValue: string;
  itemCount: number;
  notes: string | null;
  createdAt: string;
}

/** Un exemplaire acheté, copié depuis le stock au moment de l'achat. */
export interface PurchaseLine {
  id: string;
  inventoryItemId: string;
  /** Faux quand l'exemplaire a été retiré du stock depuis l'achat. */
  inStock: boolean;
  productId: string;
  productName: string;
  productType: string;
  setCode: string | null;
  setName: string | null;
  cardNumber: string | null;
  imageUrl: string | null;
  condition: string | null;
  language: string | null;
  gradingCompany: string | null;
  grade: number | null;
  reverse: boolean;
  marketPrice: string | null;
  cost: string;
}

export interface PurchaseDetail extends Purchase {
  lines: PurchaseLine[];
}

export interface PurchasesSummary {
  purchaseCount: number;
  itemCount: number;
  totalCost: string;
}

/** Stock acheté, croisé avec les prix du stock. */
export interface StockSummary {
  immobilizedCapital: string;
  potentialProfit: string;
  unpricedItemCount: number;
  uncostedItemCount: number;
}

/** Achat et coût d'un exemplaire du stock. */
export interface PurchasedItem {
  purchaseId: string;
  supplier: string;
  purchasedAt: string;
  cost: string;
}

/** Exemplaire choisi pour un achat : il n'entre au stock qu'avec l'achat. */
export interface PickedItem extends NewInventoryItem {
  product: Product;
}

/** Ligne d'un achat en cours de saisie. */
export interface PurchaseDraftLine {
  item: PickedItem;
  quantity: number;
  /** `null` : l'API répartit le reste du prix au prorata du Price Trend. */
  unitCost: number | null;
}

/** « 151 - Cartes » : le set et le type du produit acheté. */
export const lineDetails = (line: PurchaseLine): string =>
  [line.setName, PRODUCT_TYPES[line.productType]].filter(Boolean).join(' - ');
