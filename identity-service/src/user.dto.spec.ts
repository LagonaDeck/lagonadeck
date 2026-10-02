import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto, UpdateUserDto } from './user.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateUserDto, payload);
  return validate(dto);
}

const validPayload = {
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  pseudo: 'JaneDoe',
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

  it('rejette un pseudo contenant des espaces ou des emojis', async () => {
    for (const pseudo of ['jane doe', 'jane😀']) {
      const errors = await validateDto({ ...validPayload, pseudo });
      expect(errors.some((e) => e.property === 'pseudo')).toBe(true);
    }
  });

  it('retire les espaces autour des noms et rejette un nom vide une fois nettoyé', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validPayload,
      firstName: '  Jane  ',
    });
    expect(dto.firstName).toBe('Jane');

    const errors = await validateDto({ ...validPayload, lastName: '    ' });
    expect(errors.some((e) => e.property === 'lastName')).toBe(true);
  });

  it('rejette un nom de plus de 100 caractères', async () => {
    const errors = await validateDto({
      ...validPayload,
      firstName: 'a'.repeat(101),
    });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it("normalise l'email (espaces retirés, minuscules) avant validation", async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validPayload,
      email: '  Jane@Example.com  ',
    });
    expect(dto.email).toBe('jane@example.com');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('retire les espaces autour du pseudo en conservant sa casse', async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validPayload,
      pseudo: '  JaneDoe  ',
    });
    expect(dto.pseudo).toBe('JaneDoe');
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

describe('UpdateUserDto', () => {
  it('accepte un corps partiel', async () => {
    const dto = plainToInstance(UpdateUserDto, { firstName: 'Janet' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('hérite de la normalisation et de la validation de CreateUserDto', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      email: '  Jane@Example.com  ',
    });
    expect(dto.email).toBe('jane@example.com');

    const invalid = plainToInstance(UpdateUserDto, { email: 'pas-un-email' });
    const errors = await validate(invalid);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejette un mot de passe : il se change par un endpoint dédié', async () => {
    // Même configuration que le ValidationPipe global de main.ts.
    const dto = plainToInstance(UpdateUserDto, {
      password: 'Sup3rSecret!',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
