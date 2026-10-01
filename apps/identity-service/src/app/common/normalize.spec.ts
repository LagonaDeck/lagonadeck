import { normalizeEmail, normalizePseudo, trimString } from './normalize';

describe('trimString', () => {
  it('retire les espaces superflus sans toucher à la casse', () => {
    expect(trimString('  Jane  ')).toBe('Jane');
  });
});

describe('normalizeEmail', () => {
  it('retire les espaces superflus et met en minuscules', () => {
    expect(normalizeEmail('  Jane@Example.com  ')).toBe('jane@example.com');
  });

  it('ne modifie pas une valeur déjà normalisée', () => {
    expect(normalizeEmail('jane@example.com')).toBe('jane@example.com');
  });
});

describe('normalizePseudo', () => {
  it('retire les espaces superflus et met en minuscules', () => {
    expect(normalizePseudo('  JaneDoe  ')).toBe('janedoe');
  });

  it('ne modifie pas une valeur déjà normalisée', () => {
    expect(normalizePseudo('janedoe')).toBe('janedoe');
  });
});
