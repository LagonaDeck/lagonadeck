import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MediaKind, MediaStatus } from '../../generated/prisma/enums';

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
  let storage: {
    presignUpload: jest.Mock;
    presignDownload: jest.Mock;
    statObject: jest.Mock;
    deleteObject: jest.Mock;
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
    storage = {
      presignUpload: jest.fn(),
      presignDownload: jest.fn(),
      statObject: jest.fn(),
      deleteObject: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
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

    it('crée la métadonnée PENDING et renvoie une URL pré-signée', async () => {
      prisma.mediaAsset.create.mockResolvedValue(baseAsset);
      storage.presignUpload.mockResolvedValue('https://minio.local/upload');

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
      expect(result.uploadUrl).toBe('https://minio.local/upload');
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
      storage.statObject.mockResolvedValue(null);

      await expect(service.confirmUpload('media-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { status: MediaStatus.FAILED },
      });
    });

    it('passe le média en FAILED et supprime le binaire si la taille ne correspond pas', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.statObject.mockResolvedValue({
        contentType: 'image/png',
        sizeBytes: 2048,
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

    it('passe le média en FAILED et supprime le binaire si le type de contenu ne correspond pas', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.statObject.mockResolvedValue({
        contentType: 'application/pdf',
        sizeBytes: 1024,
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

    it('passe le média en READY quand le binaire correspond', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue(baseAsset);
      storage.statObject.mockResolvedValue({
        contentType: 'image/png',
        sizeBytes: 1024,
      });
      prisma.mediaAsset.update.mockResolvedValue({
        ...baseAsset,
        status: MediaStatus.READY,
      });

      const result = await service.confirmUpload('media-1');

      expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
        where: { id: 'media-1' },
        data: { status: MediaStatus.READY, sizeBytes: 1024 },
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
      expect(storage.presignDownload).not.toHaveBeenCalled();
    });

    it('ajoute une URL de téléchargement pré-signée pour un média READY', async () => {
      prisma.mediaAsset.findUnique.mockResolvedValue({
        ...baseAsset,
        status: MediaStatus.READY,
      });
      storage.presignDownload.mockResolvedValue('https://minio.local/download');

      const result = await service.findOne('media-1');

      expect(result.downloadUrl).toBe('https://minio.local/download');
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
});
