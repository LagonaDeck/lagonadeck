import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const generateSalt = (): string => {
  return randomBytes(32).toString('hex'); // 32 octets = 64 caractères hexadécimaux
};

export const hashPassword = async (
  password: string,
  salt: string,
): Promise<string> => (await scryptAsync(password, salt, 64)).toString('hex');
