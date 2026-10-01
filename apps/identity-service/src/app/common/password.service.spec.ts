import { Test } from '@nestjs/testing';
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get(PasswordService);
  });

  describe('hash', () => {
    it('ne stocke jamais le mot de passe en clair', async () => {
      const plainPassword = 'Sup3rSecret!';

      const { hash, salt } = await service.hash(plainPassword);

      expect(hash).not.toBe(plainPassword);
      expect(hash).not.toContain(plainPassword);
      expect(salt).not.toBe(plainPassword);
    });

    it('génère un salt aléatoire et unique à chaque appel, même pour le même mot de passe', async () => {
      const plainPassword = 'Sup3rSecret!';

      const first = await service.hash(plainPassword);
      const second = await service.hash(plainPassword);

      expect(first.salt).not.toBe(second.salt);
      expect(first.hash).not.toBe(second.hash);
    });

    it('produit un hash bcrypt (préfixe $2*$) contenant le facteur de coût et le salt', async () => {
      const { hash } = await service.hash('Sup3rSecret!');

      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });
  });

  describe('verify', () => {
    it('valide le bon mot de passe contre son hash', async () => {
      const plainPassword = 'Sup3rSecret!';
      const { hash } = await service.hash(plainPassword);

      await expect(service.verify(plainPassword, hash)).resolves.toBe(true);
    });

    it('rejette un mauvais mot de passe', async () => {
      const { hash } = await service.hash('Sup3rSecret!');

      await expect(service.verify('WrongPassword!', hash)).resolves.toBe(false);
    });
  });
});
