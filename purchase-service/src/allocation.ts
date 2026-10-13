import { BadRequestException } from '@nestjs/common';

/** Un exemplaire du lot, montants en centimes. */
export interface CostShare {
  /** Coût saisi par l'utilisateur : il est gardé tel quel. */
  cost?: bigint;
  /** Price Trend Cardmarket, `null` sans prix ou pour une carte gradée. */
  marketPrice: bigint | null;
}

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

export function checkFixedCosts(
  total: bigint,
  costs: (bigint | undefined)[],
): void {
  const fixed = costs.filter((cost) => cost !== undefined);
  if (sum(fixed) > total) {
    throw new BadRequestException(
      'Les coûts saisis dépassent le prix du lot, frais compris',
    );
  }
  if (fixed.length === costs.length && sum(fixed) !== total) {
    throw new BadRequestException(
      'Les coûts saisis doivent égaler le prix du lot, frais compris',
    );
  }
}

// Le reste du lot se répartit au prorata du prix du marché : une carte qui vaut
// plus coûte plus. Un exemplaire sans prix compte pour la moyenne des autres,
// et sans aucun prix, la part est égale. Les centimes perdus à l'arrondi vont
// aux plus grands restes : la somme des coûts vaut toujours le total.
export function allocateCosts(total: bigint, shares: CostShare[]): bigint[] {
  checkFixedCosts(
    total,
    shares.map(({ cost }) => cost),
  );
  const free = shares.filter(({ cost }) => cost === undefined);
  const remaining = total - sum(shares.map(({ cost }) => cost ?? 0n));
  const known = free.flatMap(({ marketPrice }) => marketPrice ?? []);
  const fallback = known.length > 0 ? sum(known) / BigInt(known.length) : 1n;
  const weights = free.map(({ marketPrice }) => marketPrice ?? fallback);
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
  return shares.map(({ cost }) => cost ?? allocated[next++]);
}
