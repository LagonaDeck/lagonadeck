import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Group } from '../models/group';
import { GroupService } from './group.service';

const sellers: Group = {
  id: 'g1',
  name: 'Vendeurs',
  isOwner: false,
  permissions: ['INVENTORY_MANAGE'],
  memberIds: [],
};
const owner: Group = { ...sellers, id: 'g0', name: 'Owner', isOwner: true };
const all = [
  'GROUP_UPDATE',
  'GROUP_DELETE',
  'MEMBER_MANAGE_GROUPS',
  'GROUP_MANAGE_PERMISSIONS',
  'PURCHASE_MANAGE',
];

describe('GroupService', () => {
  let service: GroupService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GroupService);
  });

  describe('canToggle', () => {
    it('accorde une permission qu’on possède', () => {
      expect(service.canToggle(sellers, 'PURCHASE_MANAGE', all)).toBe(true);
    });

    it('refuse d’accorder une permission qu’on ne possède pas', () => {
      expect(service.canToggle(sellers, 'BILLING_MANAGE', all)).toBe(false);
    });

    it('retire une permission accordée, même sans la posséder', () => {
      expect(
        service.canToggle(sellers, 'INVENTORY_MANAGE', [
          'GROUP_MANAGE_PERMISSIONS',
        ]),
      ).toBe(true);
    });

    it('exige la permission de gérer les permissions des groupes', () => {
      expect(
        service.canToggle(sellers, 'INVENTORY_MANAGE', ['INVENTORY_MANAGE']),
      ).toBe(false);
    });
  });

  it('ne modifie jamais le groupe Owner', () => {
    expect(service.canRename(owner, all)).toBe(false);
    expect(service.canDelete(owner, all)).toBe(false);
    expect(service.canManageMembers(owner, all)).toBe(false);
    expect(service.canToggle(owner, 'PURCHASE_MANAGE', all)).toBe(false);
  });

  it('modifie un autre groupe avec la permission correspondante', () => {
    expect(service.canRename(sellers, ['GROUP_UPDATE'])).toBe(true);
    expect(service.canDelete(sellers, ['GROUP_UPDATE'])).toBe(false);
    expect(service.canManageMembers(sellers, ['MEMBER_MANAGE_GROUPS'])).toBe(
      true,
    );
  });

  it('envoie la liste complète des permissions du groupe', () => {
    const http = TestBed.inject(HttpTestingController);

    service.setPermission('o1', sellers, 'PURCHASE_MANAGE', true).subscribe();
    service.setPermission('o1', sellers, 'INVENTORY_MANAGE', false).subscribe();

    const [granted, revoked] = http.match(
      '/api/organizations/o1/groups/g1/permissions',
    );
    expect(granted.request.body).toEqual({
      permissions: ['INVENTORY_MANAGE', 'PURCHASE_MANAGE'],
    });
    expect(revoked.request.body).toEqual({ permissions: [] });
  });
});
