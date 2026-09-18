import { MediaKind } from '../../generated/prisma/enums';
import {
  DOCUMENT_CONTENT_TYPES,
  IMAGE_CONTENT_TYPES,
  resolveMediaKind,
} from './media.constants';

describe('resolveMediaKind', () => {
  it.each(IMAGE_CONTENT_TYPES)(
    'reconnaît %s comme une image',
    (contentType) => {
      expect(resolveMediaKind(contentType)).toBe(MediaKind.IMAGE);
    },
  );

  it.each(DOCUMENT_CONTENT_TYPES)(
    'reconnaît %s comme un document',
    (contentType) => {
      expect(resolveMediaKind(contentType)).toBe(MediaKind.DOCUMENT);
    },
  );

  it('renvoie null pour un type MIME non autorisé', () => {
    expect(resolveMediaKind('application/x-msdownload')).toBeNull();
  });
});

describe('MAX_UPLOAD_SIZE_BYTES', () => {
  const ENV_KEY = 'MEDIA_MAX_UPLOAD_SIZE_BYTES';
  const originalValue = process.env[ENV_KEY];
  const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
    jest.resetModules();
  });

  async function loadWithEnv(value: string | undefined): Promise<number> {
    jest.resetModules();
    if (value === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = value;
    }
    const module = await import('./media.constants');
    return module.MAX_UPLOAD_SIZE_BYTES;
  }

  it('utilise la valeur par défaut si la variable est absente', async () => {
    await expect(loadWithEnv(undefined)).resolves.toBe(
      DEFAULT_MAX_UPLOAD_SIZE_BYTES,
    );
  });

  it('utilise la valeur par défaut si la variable est vide, au lieu de tout bloquer', async () => {
    await expect(loadWithEnv('')).resolves.toBe(DEFAULT_MAX_UPLOAD_SIZE_BYTES);
  });

  it("utilise la valeur par défaut si la variable n'est pas numérique, au lieu de désactiver la limite", async () => {
    await expect(loadWithEnv('not-a-number')).resolves.toBe(
      DEFAULT_MAX_UPLOAD_SIZE_BYTES,
    );
  });

  it('utilise la valeur par défaut si la variable est négative ou nulle', async () => {
    await expect(loadWithEnv('0')).resolves.toBe(DEFAULT_MAX_UPLOAD_SIZE_BYTES);
    await expect(loadWithEnv('-10')).resolves.toBe(
      DEFAULT_MAX_UPLOAD_SIZE_BYTES,
    );
  });

  it('utilise la valeur fournie quand elle est valide', async () => {
    await expect(loadWithEnv('1048576')).resolves.toBe(1048576);
  });
});
