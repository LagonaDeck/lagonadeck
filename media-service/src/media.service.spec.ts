const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));
jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn(),
}));

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { PrismaClient } from './generated/prisma/client';
import { MediaKind, MediaStatus } from './generated/prisma/enums';

/** Route les commandes S3 vers `storage`, pour garder des tests lisibles. */
const storage = {
  headObject: jest.fn(),
  deleteObject: jest.fn(),
};

describe('MediaService', () => {
  let service: MediaService;
  let prisma: {
    mediaAsset: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };

  const baseAsset = {
    id: 'media-1',
    ownerId: 'owner-1',
    fileName: 'photo.png',
    storageKey: 'image/owner-1/media-1',
    kind: MediaKind.IMAGE,
    contentType: 'image/png',
    sizeBytes: 1024,
    width: null,
    height: null,
    status: MediaStatus.PENDING,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      mediaAsset: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    jest.clearAllMocks();
    storage.headObject.mockReset();
    storage.deleteObject.mockReset();
    sendMock.mockImplementation(async (command) => {
      if (command instanceof HeadObjectCommand) {
        return storage.headObject(command.input.Key);
      }
      if (command instanceof DeleteObjectCommand) {
        return storage.deleteObject(command.input.Key);
      }
      throw new Error(`Commande S3 inattendue : ${command.constructor.name}`);
    });

    const module = await Test.createTestingModule({
      providers: [MediaService, { provide: PrismaClient, useValue: prisma }],
    }).compile();

    service = module.get(MediaService);
  });

  describe('requestUpload', () => {
    it('rejette un type de contenu non autorisé', async () => {
      await expect(
        service.requestUpload({
          ownerId: 'owner-1',
          fileName: 'malware.exe',
          contentType: 'application/x-msdownload',
          sizeBytes: 10,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
    });

    it('rejette un fichier trop volumineux', async () => {
      await expect(
        service.requestUpload({
          ownerId: 'owner-1',
          fileName: 'big.png',
          contentType: 'image/png',
          sizeBytes: 1024 * 1024 * 1024,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
    });

    it('crée la métadonnée PENDING et renvoie un POST pré-signé figeant le type et la taille', async () => {
      prisma.mediaAsset.create.mockResolvedValue(baseAsset);
      (createPresignedPost as jest.Mock).mockResolvedValue({
        url: 'https://minio.local/lagonadeck-media',
        fields: { key: 'image/owner-1/media-1', 'Content-Type': 'image/png' },
      });

      const result = await service.requestUpload({
        ownerId: 'owner-1',
        fileName: 'photo.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      });

      expect(prisma.mediaAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'owner-1',
            fileName: 'photo.png',
            kind: MediaKind.IMAGE,
            status: MediaStatus.PENDING,
          }),
        }),
      );
      expect(createPresignedPost).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          Bucket: 'lagonadeck-media',
          Conditions: [
            ['content-length-range', 1024, 1024],
            ['eq', '$Content-Type', 'image/png'],
          ],
          Fields: { 'Content-Type': 'image/png' },
        }),
      );
      expect(result.uploadUrl).toBe('https://minio.local/lagonadeck-media');
      expect(result.uploadFields).toEqual({
        key: 'image/owner-1/media-1',
        'Content-Type': 'image/png',
      });
      expect(result.id).toEqual(expect.any(String));
    });
  });

  describe('confirmUpload', () => {
    it('lève une 404 si le média est inconnu', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      await expect(service.confirmUpload('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('passe le média en FAILED si le binaire est absent du storage', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.headObject.mockRejectedValue(new NotFound({ $metadata: {} }));

      await expect(service.confirmUpload('media-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { status: MediaStatus.FAILED },
      });
    });

    it('passe le média en FAILED puis supprime le binaire si la taille ne correspond pas (FAILED avant la suppression)', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.headObject.mockResolvedValue({
        ContentType: 'image/png',
        ContentLength: 2048,
      });
      const callOrder: string[] = [];
      prisma.mediaAsset.update.mockImplementation(async () => {
        callOrder.push('update-failed');
        return baseAsset;
      });
      storage.deleteObject.mockImplementation(async () => {
        callOrder.push('delete-object');
      });

      await expect(service.confirmUpload('media-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { status: MediaStatus.FAILED },
      });
      expect(storage.deleteObject).toHaveBeenCalledWith(baseAsset.storageKey);
      expect(callOrder).toEqual(['update-failed', 'delete-object']);
    });

    it('passe le média en FAILED et supprime le binaire si le type de contenu ne correspond pas', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.headObject.mockResolvedValue({
        ContentType: 'application/pdf',
        ContentLength: 1024,
      });

      await expect(service.confirmUpload('media-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(storage.deleteObject).toHaveBeenCalledWith(baseAsset.storageKey);
      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { status: MediaStatus.FAILED },
      });
    });

    it('passe le média en FAILED même si HeadObject ne renvoie aucun Content-Type', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.headObject.mockResolvedValue({
        ContentType: undefined,
        ContentLength: 1024,
      });

      await expect(service.confirmUpload('media-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { status: MediaStatus.FAILED },
      });
    });

    it('renvoie tout de même le 422 si la suppression du binaire incohérent échoue', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.headObject.mockResolvedValue({
        ContentType: 'application/pdf',
        ContentLength: 1024,
      });
      storage.deleteObject.mockRejectedValue(new Error('storage indisponible'));

      await expect(service.confirmUpload('media-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { status: MediaStatus.FAILED },
      });
    });

    it('propage une erreur S3 autre que NotFound sans toucher au statut', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.headObject.mockRejectedValue(new Error('boom'));

      await expect(service.confirmUpload('media-1')).rejects.toThrow('boom');
      expect(prisma.mediaAsset.update).not.toHaveBeenCalled();
    });

    it('passe le média en READY quand le binaire correspond', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.headObject.mockResolvedValue({
        ContentType: 'image/png',
        ContentLength: 1024,
      });
      prisma.mediaAsset.update.mockResolvedValue({
        ...baseAsset,
        status: MediaStatus.READY,
      });

      const result = await service.confirmUpload('media-1');

      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { status: MediaStatus.READY },
      });
      expect(result.status).toBe(MediaStatus.READY);
    });
  });

  describe('findOne', () => {
    it('lève une 404 si le média est inconnu', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("n'ajoute pas d'URL de téléchargement pour un média non prêt", async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);

      const result = await service.findOne('media-1');

      expect(result.downloadUrl).toBeUndefined();
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('ajoute une URL de téléchargement pré-signée pour un média READY', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        ...baseAsset,
        status: MediaStatus.READY,
      });
      (getSignedUrl as jest.Mock).mockResolvedValue(
        'https://minio.local/download',
      );

      const result = await service.findOne('media-1');

      expect(result.downloadUrl).toBe('https://minio.local/download');
      const [, command] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'lagonadeck-media',
        Key: baseAsset.storageKey,
      });
    });
  });

  describe('remove', () => {
    it('supprime le binaire puis la métadonnée', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);

      await service.remove('media-1');

      expect(storage.deleteObject).toHaveBeenCalledWith(baseAsset.storageKey);
      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: 'media-1' },
      });
    });
  });

  describe('purgeStalePendingAssets', () => {
    it("ne fait rien si aucun média PENDING n'est périmé", async () => {
      prisma.mediaAsset.findMany.mockResolvedValue([]);

      await service.purgeStalePendingAssets();

      expect(storage.deleteObject).not.toHaveBeenCalled();
      expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
    });

    it("filtre sur les médias PENDING créés avant la fenêtre d'upload", async () => {
      prisma.mediaAsset.findMany.mockResolvedValue([]);

      await service.purgeStalePendingAssets();

      expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
        where: {
          status: MediaStatus.PENDING,
          createdAt: { lt: expect.any(Date) },
        },
      });
    });

    it('supprime le binaire (best-effort) puis la métadonnée de chaque média périmé', async () => {
      const stale = {
        ...baseAsset,
        id: 'stale-1',
        storageKey: 'image/owner-1/stale-1',
      };
      prisma.mediaAsset.findMany.mockResolvedValue([stale]);

      await service.purgeStalePendingAssets();

      expect(storage.deleteObject).toHaveBeenCalledWith(stale.storageKey);
      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: 'stale-1' },
      });
    });

    it('purge quand même la métadonnée si la suppression du binaire échoue', async () => {
      const stale = {
        ...baseAsset,
        id: 'stale-1',
        storageKey: 'image/owner-1/stale-1',
      };
      prisma.mediaAsset.findMany.mockResolvedValue([stale]);
      storage.deleteObject.mockRejectedValue(new Error('storage indisponible'));

      await service.purgeStalePendingAssets();

      expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({
        where: { id: 'stale-1' },
      });
    });
  });
});
