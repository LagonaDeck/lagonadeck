import { BadRequestException } from '@nestjs/common';
import { allocate, checkFixedPrices } from './allocation';

const weighted = (weight: bigint) => ({ weight });
const unweighted = { weight: null };

describe('allocate', () => {
  it('répartit la vente au prorata du prix du marché', () => {
    expect(allocate(6000n, [weighted(4000n), weighted(2000n)])).toEqual([
      4000n,
      2000n,
    ]);
  });

  it('donne à un exemplaire sans prix la moyenne des autres', () => {
    expect(
      allocate(9000n, [weighted(4000n), weighted(2000n), unweighted]),
    ).toEqual([4000n, 2000n, 3000n]);
  });

  it('partage à parts égales quand aucun exemplaire n’a de prix', () => {
    expect(allocate(900n, [unweighted, unweighted, unweighted])).toEqual([
      300n,
      300n,
      300n,
    ]);
  });

  it('partage à parts égales quand tous les poids sont nuls', () => {
    expect(allocate(500n, [weighted(0n), weighted(0n)])).toEqual([250n, 250n]);
  });

  it('donne les centimes de l’arrondi aux plus grands restes, pour un total exact', () => {
    const prices = allocate(1000n, [unweighted, unweighted, unweighted]);

    expect(prices).toEqual([334n, 333n, 333n]);
    expect(prices.reduce((a, b) => a + b)).toBe(1000n);
  });

  it('garde les prix saisis et répartit seulement le reste', () => {
    expect(
      allocate(10000n, [
        { amount: 7000n, weight: 1000n },
        weighted(2000n),
        weighted(1000n),
      ]),
    ).toEqual([7000n, 2000n, 1000n]);
  });

  it('accepte une vente gratuite', () => {
    expect(allocate(0n, [weighted(500n), unweighted])).toEqual([0n, 0n]);
  });
});

describe('checkFixedPrices', () => {
  it('refuse des prix saisis qui dépassent le prix de la vente', () => {
    expect(() => checkFixedPrices(1000n, [1200n, undefined])).toThrow(
      BadRequestException,
    );
  });

  it('refuse des prix tous saisis dont la somme ne fait pas le prix de la vente', () => {
    expect(() => checkFixedPrices(1000n, [400n, 500n])).toThrow(
      BadRequestException,
    );
  });

  it('accepte des prix saisis qui laissent un reste à répartir', () => {
    expect(() => checkFixedPrices(1000n, [400n, undefined])).not.toThrow();
  });
});
