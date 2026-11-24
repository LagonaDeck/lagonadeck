import { HttpException, Injectable } from '@nestjs/common';

/** Coût d'un exemplaire, tel que purchase le renvoie. */
export interface PurchasedItem {
  inventoryItemId: string;
  cost: string;
}

// Le coût d'un exemplaire vit dans purchase, qui vérifie que l'utilisateur
// transmis est membre. Ses erreurs sont renvoyées sans être réécrites.
@Injectable()
export class PurchaseService {
  /** Ceux des exemplaires demandés qui viennent d'un achat. */
  async findItems(
    userId: string,
    organizationId: string,
    ids: string[],
  ): Promise<PurchasedItem[]> {
    const query = new URLSearchParams({ ids: ids.join(',') });
    const response = await fetch(
      `${process.env.PURCHASE_SERVICE_URL}/api/organizations/${organizationId}/purchases/items?${query}`,
      {
        headers: {
          'x-internal-token': process.env.INTERNAL_TOKEN!,
          'x-user-id': userId,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    const payload = (await response.json()) as PurchasedItem[];
    if (!response.ok) {
      throw new HttpException(payload as object, response.status);
    }
    return payload;
  }
}
