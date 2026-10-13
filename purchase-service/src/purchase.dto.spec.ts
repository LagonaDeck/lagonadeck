import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePurchaseDto } from './purchase.dto';

const PRODUCT_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';

const purchase = {
  supplier: 'Vinted',
  purchasedAt: '2026-10-13',
  price: 120,
  lines: [{ productId: PRODUCT_ID, language: 'FRENCH' }],
};

const errorsOf = async (payload: object) =>
  (await validate(plainToInstance(CreatePurchaseDto, payload))).map(
    ({ property }) => property,
  );

describe('CreatePurchaseDto', () => {
  it('accepte un achat avec son fournisseur, sa date, son prix et un exemplaire', async () => {
    expect(await errorsOf(purchase)).toEqual([]);
  });

  it('exige au moins un exemplaire', async () => {
    expect(await errorsOf({ ...purchase, lines: [] })).toEqual(['lines']);
  });

  it('refuse un prix au-delà du centime', async () => {
    expect(await errorsOf({ ...purchase, price: 10.005 })).toEqual(['price']);
  });

  it('refuse un fournisseur vide', async () => {
    expect(await errorsOf({ ...purchase, supplier: '   ' })).toEqual([
      'supplier',
    ]);
  });

  it('refuse une date qui n’en est pas une', async () => {
    expect(await errorsOf({ ...purchase, purchasedAt: '2026-13-45' })).toEqual([
      'purchasedAt',
    ]);
  });
});
