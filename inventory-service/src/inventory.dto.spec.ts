import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddInventoryItemDto } from './inventory.dto';

const PRODUCT_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';

const errorsOf = async (payload: object) =>
  (await validate(plainToInstance(AddInventoryItemDto, payload))).map(
    ({ property }) => property,
  );

describe('AddInventoryItemDto', () => {
  it('accepte un exemplaire avec sa langue', async () => {
    expect(
      await errorsOf({ productId: PRODUCT_ID, language: 'FRENCH' }),
    ).toEqual([]);
  });

  it('exige la langue de l’exemplaire', async () => {
    expect(await errorsOf({ productId: PRODUCT_ID })).toEqual(['language']);
  });
});
