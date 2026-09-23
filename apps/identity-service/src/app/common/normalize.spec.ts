import { normalizeEmail, normalizePseudo } from './normalize';

describe('normalizeEmail', () => {
  it('retire les espaces superflus et met en minuscules', () => {
    expect(normalizeEmail('  Jane@Example.com  ')).toBe('jane@example.com');
  });

  it('est idempotente', () => {
    expect(normalizeEmail('jane@example.com')).toBe('jane@example.com');
  });
});

describe('normalizePseudo', () => {
  it('retire les espaces superflus et met en minuscules', () => {
    expect(normalizePseudo('  JaneDoe  ')).toBe('janedoe');
  });

  it('est idempotente', () => {
    expect(normalizePseudo('janedoe')).toBe('janedoe');
  });
});
