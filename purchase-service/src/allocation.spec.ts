import { BadRequestException } from '@nestjs/common';
import { allocateCosts } from './allocation';

const priced = (marketPrice: bigint) => ({ marketPrice });
const unpriced = { marketPrice: null };

describe('allocateCosts', () => {
  it('répartit le lot au prorata du prix du marché', () => {
    expect(allocateCosts(6000n, [priced(4000n), priced(2000n)])).toEqual([
      4000n,
      2000n,
    ]);
  });

  it('donne à un exemplaire sans prix la moyenne des autres', () => {
    expect(
      allocateCosts(9000n, [priced(4000n), priced(2000n), unpriced]),
    ).toEqual([4000n, 2000n, 3000n]);
  });

  it('partage à parts égales quand aucun exemplaire n’a de prix', () => {
    expect(allocateCosts(900n, [unpriced, unpriced, unpriced])).toEqual([
      300n,
      300n,
      300n,
    ]);
  });

  it('donne les centimes de l’arrondi aux plus grands restes, pour un total exact', () => {
    const costs = allocateCosts(1000n, [unpriced, unpriced, unpriced]);

    expect(costs).toEqual([334n, 333n, 333n]);
    expect(costs.reduce((a, b) => a + b)).toBe(1000n);
  });

  it('garde les coûts saisis et répartit seulement le reste', () => {
    expect(
      allocateCosts(10000n, [
        { cost: 7000n, marketPrice: 1000n },
        priced(2000n),
        priced(1000n),
      ]),
    ).toEqual([7000n, 2000n, 1000n]);
  });

  it('refuse des coûts saisis qui dépassent le prix du lot', () => {
    expect(() =>
      allocateCosts(1000n, [{ cost: 1200n, marketPrice: null }, unpriced]),
    ).toThrow(BadRequestException);
  });

  it('refuse des coûts tous saisis dont la somme ne fait pas le prix du lot', () => {
    expect(() =>
      allocateCosts(1000n, [
        { cost: 400n, marketPrice: null },
        { cost: 500n, marketPrice: null },
      ]),
    ).toThrow(BadRequestException);
  });

  it('accepte un lot gratuit', () => {
    expect(allocateCosts(0n, [priced(500n), unpriced])).toEqual([0n, 0n]);
  });
});
