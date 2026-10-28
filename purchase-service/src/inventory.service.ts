import { HttpException, Injectable } from '@nestjs/common';

export interface NewInventoryItem {
  id: string;
  productId: string;
  condition?: string;
  language: string;
  gradingCompany?: string;
  grade?: number;
  reverse?: boolean;
}

/** Exemplaire tel qu'inventory le renvoie, réduit à ce qu'un achat garde. */
export interface InventoryItem {
  id: string;
  condition: string | null;
  language: string | null;
  gradingCompany: string | null;
  grade: number | null;
  reverse: boolean;
  price: string | null;
  product: {
    id: string;
    name: string;
    productType: string;
    setCode: string | null;
    setName: string | null;
    cardNumber: string | null;
    imageUrl: string | null;
  };
}

// Le stock vit dans inventory : il valide les exemplaires et vérifie
// INVENTORY_MANAGE avec le token de l'utilisateur, transmis tel quel. Ses
// erreurs (400, 403, 404, 409) sont renvoyées sans être réécrites.
@Injectable()
export class InventoryService {
  // Tout ou rien, avec les ids choisis par l'appelant : ils permettent de
  // retirer le lot même quand la réponse n'arrive pas.
  addItems(
    authorization: string,
    organizationId: string,
    items: NewInventoryItem[],
  ): Promise<InventoryItem[]> {
    return this.call(authorization, organizationId, '/batch', {
      method: 'POST',
      body: { items },
    });
  }

  // Un exemplaire déjà retiré est ignoré : le retrait peut être rejoué.
  async removeItems(
    authorization: string,
    organizationId: string,
    ids: string[],
  ): Promise<void> {
    await this.call(authorization, organizationId, '/batch', {
      method: 'DELETE',
      body: { ids },
    });
  }

  /** Ceux des exemplaires demandés qui sont encore au stock. */
  findItems(
    authorization: string,
    organizationId: string,
    ids: string[],
  ): Promise<InventoryItem[]> {
    const query = new URLSearchParams({
      ids: ids.join(','),
      take: String(ids.length),
    });
    return this.call(authorization, organizationId, `?${query}`, {
      method: 'GET',
    });
  }

  private async call<T>(
    authorization: string,
    organizationId: string,
    path: string,
    init: { method: string; body?: unknown },
  ): Promise<T> {
    const response = await fetch(
      `${process.env.INVENTORY_SERVICE_URL}/api/organizations/${organizationId}/inventory${path}`,
      {
        method: init.method,
        headers: { authorization, 'content-type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(5000),
      },
    );
    const payload = (
      response.status === 204 ? undefined : await response.json()
    ) as T;
    if (!response.ok) {
      throw new HttpException(payload as object, response.status);
    }
    return payload;
  }
}
