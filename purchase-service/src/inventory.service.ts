import { HttpException, Injectable } from '@nestjs/common';

export interface NewInventoryItem {
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

// Le stock vit dans inventory : il valide l'exemplaire et vérifie
// INVENTORY_MANAGE avec le token de l'utilisateur, transmis tel quel. Ses
// erreurs (400, 403, 404) sont renvoyées sans être réécrites.
@Injectable()
export class InventoryService {
  async addItem(
    authorization: string,
    organizationId: string,
    item: NewInventoryItem,
  ): Promise<InventoryItem> {
    const response = await this.call(authorization, organizationId, '', {
      method: 'POST',
      body: item,
    });
    return (await response.json()) as InventoryItem;
  }

  // Un exemplaire déjà retiré du stock n'est pas une erreur.
  async removeItem(
    authorization: string,
    organizationId: string,
    itemId: string,
  ): Promise<void> {
    await this.call(authorization, organizationId, `/${itemId}`, {
      method: 'DELETE',
      allowNotFound: true,
    });
  }

  private async call(
    authorization: string,
    organizationId: string,
    path: string,
    init: { method: string; body?: unknown; allowNotFound?: boolean },
  ): Promise<Response> {
    const response = await fetch(
      `${process.env.INVENTORY_SERVICE_URL}/api/organizations/${organizationId}/inventory${path}`,
      {
        method: init.method,
        headers: { authorization, 'content-type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok && !(init.allowNotFound && response.status === 404)) {
      throw new HttpException(
        (await response.json()) as object,
        response.status,
      );
    }
    return response;
  }
}
