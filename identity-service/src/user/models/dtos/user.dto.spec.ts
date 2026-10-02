import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './user.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateUserDto, payload);
  return validate(dto);
}

const validPayload = {
  email: 'jane@example.com',
  username: 'JaneDoe',
  password: 'Sup3rSecret!',
};

describe('CreateUserDto', () => {
  it("n'a aucune erreur pour un payload valide", async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('rejette un email au mauvais format', async () => {
    const errors = await validateDto({
      ...validPayload,
      email: 'pas-un-email',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejette un mot de passe trop court', async () => {
    const errors = await validateDto({ ...validPayload, password: 'Ab1!' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejette un mot de passe sans majuscule/minuscule (robustesse insuffisante)', async () => {
    const errors = await validateDto({
      ...validPayload,
      password: 'alllowercase1',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejette un mot de passe sans chiffre ni caractère spécial', async () => {
    const errors = await validateDto({
      ...validPayload,
      password: 'NoDigitsHere',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepte un mot de passe avec majuscule, minuscule et un caractère spécial (sans chiffre)', async () => {
    const errors = await validateDto({
      ...validPayload,
      password: 'NoDigits!',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(false);
  });

  it('rejette un nom d’utilisateur trop court', async () => {
    const errors = await validateDto({ ...validPayload, username: 'ab' });
    expect(errors.some((e) => e.property === 'username')).toBe(true);
  });

  it('accepte un mot de passe de 72 octets', async () => {
    const errors = await validateDto({
      ...validPayload,
      password: 'A1!' + 'a'.repeat(69),
    });
    expect(errors.some((e) => e.property === 'password')).toBe(false);
  });

  it('rejette un mot de passe ASCII de plus de 72 octets', async () => {
    const errors = await validateDto({
      ...validPayload,
      password: 'A1!' + 'a'.repeat(70),
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('mesure la limite en octets : 40 caractères accentués dépassent 72 octets', async () => {
    const password = 'Aa1' + 'é'.repeat(37);
    expect(password).toHaveLength(40);
    expect(Buffer.byteLength(password, 'utf8')).toBe(77);

    const errors = await validateDto({ ...validPayload, password });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('ne compte pas une lettre accentuée comme caractère spécial', async () => {
    const errors = await validateDto({
      ...validPayload,
      password: 'Passwordé',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepte des lettres accentuées comme majuscule et minuscule', async () => {
    const errors = await validateDto({
      ...validPayload,
      password: 'ÉLÉMENTé1',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(false);
  });

  it('rejette un nom d’utilisateur contenant des espaces ou des emojis', async () => {
    for (const username of ['jane doe', 'jane😀']) {
      const errors = await validateDto({ ...validPayload, username });
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    }
  });

  it("normalise l'email (espaces retirés, minuscules) avant validation", async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validPayload,
      email: '  Jane@Example.com  ',
    });
    expect(dto.email).toBe('jane@example.com');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('retire les espaces autour du nom d’utilisateur en conservant sa casse', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validPayload,
      username: '  JaneDoe  ',
    });
    expect(dto.username).toBe('JaneDoe');
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['email', 'username', 'password'] as const)(
    'rejette un payload sans %s',
    async (field) => {
      const payload = { ...validPayload };
      delete (payload as Record<string, unknown>)[field];

      const errors = await validateDto(payload);

      expect(errors.some((e) => e.property === field)).toBe(true);
    },
  );
});
