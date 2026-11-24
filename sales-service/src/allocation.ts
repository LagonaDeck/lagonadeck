import { BadRequestException } from '@nestjs/common';

/** Un exemplaire de la vente, montants en centimes. */
export interface Share {
  /** Montant saisi par l'utilisateur : il est gardé tel quel. */
  amount?: bigint;
  /** Poids dans la répartition du reste, `null` quand il est inconnu. */
  weight: bigint | null;
}

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

export function checkFixedPrices(
  total: bigint,
  prices: (bigint | undefined)[],
): void {
  const fixed = prices.filter((price) => price !== undefined);
  if (sum(fixed) > total) {
    throw new BadRequestException(
      'Les prix saisis dépassent le prix de la vente',
    );
  }
  if (fixed.length === prices.length && sum(fixed) !== total) {
    throw new BadRequestException(
      'Les prix saisis doivent égaler le prix de la vente',
    );
  }
}

// Le reste se répartit au prorata du poids : une carte qui vaut plus se vend
// plus cher. Un poids inconnu compte pour la moyenne des autres, et sans aucun
// poids, la part est égale. Les centimes perdus à l'arrondi vont aux plus
// grands restes : la somme des parts vaut toujours le total.
// Les montants saisis ont été validés avant, par checkFixedPrices.
export function allocate(total: bigint, shares: Share[]): bigint[] {
  const free = shares.filter(({ amount }) => amount === undefined);
  const remaining = total - sum(shares.map(({ amount }) => amount ?? 0n));
  const known = free.flatMap(({ weight }) => weight ?? []);
  const fallback = known.length > 0 ? sum(known) / BigInt(known.length) : 1n;
  let weights = free.map(({ weight }) => weight ?? fallback);
  if (sum(weights) === 0n) weights = weights.map(() => 1n);
  const totalWeight = sum(weights);

  const allocated = weights.map((weight) => (remaining * weight) / totalWeight);
  const leftover = Number(remaining - sum(allocated));
  weights
    .map((weight, index) => ({
      index,
      rest: (remaining * weight) % totalWeight,
    }))
    .sort((a, b) =>
      a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1,
    )
    .slice(0, leftover)
    .forEach(({ index }) => (allocated[index] += 1n));

  let next = 0;
  return shares.map(({ amount }) => amount ?? allocated[next++]);
}
