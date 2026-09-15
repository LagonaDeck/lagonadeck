const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MEDIA_S3_BUCKET = 'lagonadeck-media';
    process.env.MEDIA_S3_ENDPOINT = 'http://localhost:9000';
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('présigne une URL de PUT sur le bon bucket/clé', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue('https://minio.local/put');
    const service = new StorageService();

    const url = await service.presignUpload('image/owner-1/media-1', 120);

    expect(url).toBe('https://minio.local/put');
    const [, command, options] = (getSignedUrl as jest.Mock).mock.calls[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'lagonadeck-media',
      Key: 'image/owner-1/media-1',
    });
    expect(options).toEqual({ expiresIn: 120 });
  });

  it('présigne une URL de GET sur le bon bucket/clé', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue('https://minio.local/get');
    const service = new StorageService();

    const url = await service.presignDownload('image/owner-1/media-1', 60);

    expect(url).toBe('https://minio.local/get');
    const [, command, options] = (getSignedUrl as jest.Mock).mock.calls[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'lagonadeck-media',
      Key: 'image/owner-1/media-1',
    });
    expect(options).toEqual({ expiresIn: 60 });
  });

  describe('statObject', () => {
    it("renvoie les métadonnées quand l'objet existe", async () => {
      sendMock.mockResolvedValue({
        ContentType: 'image/png',
        ContentLength: 2048,
      });
      const service = new StorageService();

      const info = await service.statObject('image/owner-1/media-1');

      expect(info).toEqual({ contentType: 'image/png', sizeBytes: 2048 });
      expect(sendMock.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    });

    it("renvoie null quand l'objet est absent (NotFound)", async () => {
      sendMock.mockRejectedValue(new NotFound({ $metadata: {} }));
      const service = new StorageService();

      await expect(service.statObject('missing/key')).resolves.toBeNull();
    });

    it('propage les autres erreurs', async () => {
      sendMock.mockRejectedValue(new Error('boom'));
      const service = new StorageService();

      await expect(service.statObject('image/owner-1/media-1')).rejects.toThrow(
        'boom',
      );
    });
  });

  describe('deleteObject', () => {
    it("supprime l'objet sur le bon bucket/clé", async () => {
      sendMock.mockResolvedValue({});
      const service = new StorageService();

      await service.deleteObject('image/owner-1/media-1');

      const command = sendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'lagonadeck-media',
        Key: 'image/owner-1/media-1',
      });
    });
  });
});
