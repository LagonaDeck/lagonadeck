import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateUserDto, payload);
  return validate(dto);
}

const validPayload = {
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  pseudo: 'janedoe',
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

  it('rejette un pseudo trop court', async () => {
    const errors = await validateDto({ ...validPayload, pseudo: 'ab' });
    expect(errors.some((e) => e.property === 'pseudo')).toBe(true);
  });

  it('rejette un mot de passe trop long (au-delà de la troncature bcrypt à 72 octets)', async () => {
    // 65 caractères : au-dessus de la limite (64) sans pour autant tester
    // spécifiquement la troncature bcrypt à 72 octets, qui est documentée
    // séparément (ADR 0007) et vérifiée dans password.service.spec.ts.
    const longPassword = 'A1!' + 'a'.repeat(62);
    const errors = await validateDto({
      ...validPayload,
      password: longPassword,
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it("normalise l'email (espaces retirés, minuscules) avant validation", async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validPayload,
      email: '  Jane@Example.com  ',
    });
    expect(dto.email).toBe('jane@example.com');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('normalise le pseudo (espaces retirés, minuscules) avant validation', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validPayload,
      pseudo: '  JaneDoe  ',
    });
    expect(dto.pseudo).toBe('janedoe');
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['email', 'firstName', 'lastName', 'pseudo', 'password'] as const)(
    'rejette un payload sans %s',
    async (field) => {
      const payload = { ...validPayload };
      delete (payload as Record<string, unknown>)[field];

      const errors = await validateDto(payload);

      expect(errors.some((e) => e.property === field)).toBe(true);
    },
  );
});
