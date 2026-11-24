import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSaleDto, SalesSummaryQueryDto } from './sale.dto';

const ITEM_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';

const sale = {
  buyer: 'Cardmarket',
  soldAt: '2026-11-24',
  price: 80,
  lines: [{ inventoryItemId: ITEM_ID }],
};

const errorsOf = async (payload: object) =>
  (await validate(plainToInstance(CreateSaleDto, payload))).map(
    ({ property }) => property,
  );

describe('CreateSaleDto', () => {
  it('accepte une vente avec son acheteur, sa date, son prix et un exemplaire', async () => {
    expect(await errorsOf(sale)).toEqual([]);
  });

  it('exige au moins un exemplaire', async () => {
    expect(await errorsOf({ ...sale, lines: [] })).toEqual(['lines']);
  });

  it('refuse le même exemplaire deux fois dans une vente', async () => {
    expect(
      await errorsOf({ ...sale, lines: [...sale.lines, ...sale.lines] }),
    ).toEqual(['lines']);
  });

  it('accepte deux exemplaires distincts du même produit', async () => {
    expect(
      await errorsOf({
        ...sale,
        lines: [
          ...sale.lines,
          { inventoryItemId: '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e' },
        ],
      }),
    ).toEqual([]);
  });

  it('refuse un prix au-delà du centime', async () => {
    expect(await errorsOf({ ...sale, price: 10.005 })).toEqual(['price']);
  });

  it('refuse un acheteur vide', async () => {
    expect(await errorsOf({ ...sale, buyer: '   ' })).toEqual(['buyer']);
  });

  it('refuse une date-heure, qui changerait de jour selon le fuseau', async () => {
    expect(
      await errorsOf({ ...sale, soldAt: '2026-11-24T01:00:00+02:00' }),
    ).toEqual(['soldAt']);
  });

  it('refuse des frais ou un prix unitaire à null', async () => {
    const errors = await validate(
      plainToInstance(CreateSaleDto, {
        ...sale,
        fees: null,
        lines: [{ inventoryItemId: ITEM_ID, unitPrice: null }],
      }),
    );

    expect(errors.map(({ property }) => property)).toEqual(['fees', 'lines']);
    expect(
      errors[1].children?.[0].children?.map(({ property }) => property),
    ).toEqual(['unitPrice']);
  });
});

describe('SalesSummaryQueryDto', () => {
  it('accepte une période de jours', async () => {
    expect(
      await validate(
        plainToInstance(SalesSummaryQueryDto, {
          from: '2026-11-01',
          to: '2026-11-30',
        }),
      ),
    ).toEqual([]);
  });

  it('refuse un mois sans jour', async () => {
    const errors = await validate(
      plainToInstance(SalesSummaryQueryDto, { from: '2026-11' }),
    );

    expect(errors.map(({ property }) => property)).toEqual(['from']);
  });
});
