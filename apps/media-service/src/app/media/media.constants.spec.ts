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
