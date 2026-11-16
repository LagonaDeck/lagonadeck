import { Product } from './product';

export interface Report {
  id: string;
  product: Product | null;
  message: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt: string | null;
}
