import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

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
