import { Test } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaKind, MediaStatus } from '../../generated/prisma/enums';

describe('MediaController', () => {
  let controller: MediaController;
  let service: {
    requestUpload: jest.Mock;
    confirmUpload: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };

  const asset = {
    id: 'media-1',
    ownerId: 'owner-1',
    fileName: 'photo.png',
    kind: MediaKind.IMAGE,
    contentType: 'image/png',
    sizeBytes: 1024,
    width: null,
    height: null,
    status: MediaStatus.READY,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    service = {
      requestUpload: jest.fn(),
      confirmUpload: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: service }],
    }).compile();

    controller = module.get(MediaController);
  });

  it('délègue la demande d\'upload au service', async () => {
    const dto = {
      ownerId: 'owner-1',
      fileName: 'photo.png',
      contentType: 'image/png',
      sizeBytes: 1024,
    };
    const response = {
      id: 'media-1',
      uploadUrl: 'https://minio.local/upload',
      expiresInSeconds: 900,
    };
    service.requestUpload.mockResolvedValue(response);

    await expect(controller.requestUpload(dto)).resolves.toBe(response);
    expect(service.requestUpload).toHaveBeenCalledWith(dto);
  });

  it('délègue la confirmation d\'upload au service', async () => {
    service.confirmUpload.mockResolvedValue(asset);

    await expect(controller.confirmUpload('media-1')).resolves.toBe(asset);
    expect(service.confirmUpload).toHaveBeenCalledWith('media-1');
  });

  it('délègue la liste au service avec la query', async () => {
    service.findAll.mockResolvedValue([asset]);
    const query = { ownerId: 'owner-1', take: 20, skip: 0 };

    await expect(controller.findAll(query)).resolves.toEqual([asset]);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('délègue la lecture d\'un média au service', async () => {
    service.findOne.mockResolvedValue(asset);

    await expect(controller.findOne('media-1')).resolves.toBe(asset);
    expect(service.findOne).toHaveBeenCalledWith('media-1');
  });

  it('délègue la suppression au service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('media-1');
    expect(service.remove).toHaveBeenCalledWith('media-1');
  });
});
