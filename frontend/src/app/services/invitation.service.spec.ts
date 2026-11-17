import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  let service: InvitationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvitationService);
    http = TestBed.inject(HttpTestingController);
  });

  it('annule l’invitation d’un compte par son identifiant', () => {
    service
      .revoke('o1', { userId: 'u3', username: 'bob', createdAt: '' })
      .subscribe();

    expect(
      http.expectOne('/api/organizations/o1/invitations/u3').request.method,
    ).toBe('DELETE');
  });

  it('annule l’invitation d’une adresse sans compte, encodée dans l’URL', () => {
    service
      .revoke('o1', { email: 'eve+test@example.test', createdAt: '' })
      .subscribe();

    http.expectOne(
      '/api/organizations/o1/email-invitations/eve%2Btest%40example.test',
    );
  });

  it('reconnaît une adresse email', () => {
    expect(service.isEmail('eve@example.test')).toBe(true);
    expect(service.isEmail('eve')).toBe(false);
    expect(service.isEmail('eve@example')).toBe(false);
    expect(service.isEmail('eve @example.test')).toBe(false);
  });
});
