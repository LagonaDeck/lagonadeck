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

jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn(),
}));

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
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

  it('présigne un POST sur le bon bucket/clé, en figeant le Content-Type et la taille exacte', async () => {
    (createPresignedPost as jest.Mock).mockResolvedValue({
      url: 'https://minio.local/lagonadeck-media',
      fields: { key: 'image/owner-1/media-1', 'Content-Type': 'image/png' },
    });
    const service = new StorageService();

    const result = await service.presignUpload(
      'image/owner-1/media-1',
      'image/png',
      2048,
      120,
    );

    expect(result).toEqual({
      url: 'https://minio.local/lagonadeck-media',
      fields: { key: 'image/owner-1/media-1', 'Content-Type': 'image/png' },
    });
    expect(createPresignedPost).toHaveBeenCalledWith(expect.anything(), {
      Bucket: 'lagonadeck-media',
      Key: 'image/owner-1/media-1',
      Expires: 120,
      Conditions: [
        ['content-length-range', 2048, 2048],
        ['eq', '$Content-Type', 'image/png'],
      ],
      Fields: { 'Content-Type': 'image/png' },
    });
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
