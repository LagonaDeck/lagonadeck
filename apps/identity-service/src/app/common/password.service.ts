import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly saltRounds = 10;

  /**
   * Hache un mot de passe en clair.
   * Génère un salt aléatoire et unique à chaque appel (bcrypt.genSalt).
   */
  async hash(plainPassword: string): Promise<{ hash: string; salt: string }> {
    const salt = await bcrypt.genSalt(this.saltRounds);
    const hash = await bcrypt.hash(plainPassword, salt);
    return { hash, salt };
  }

  /**
   * Vérifie un mot de passe en clair contre un hash stocké.
   */
  async verify(plainPassword: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }
}