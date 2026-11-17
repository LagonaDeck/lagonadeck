import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InventoryService);
  });

  describe('itemFromForm', () => {
    it('garde l’état d’une carte brute', () => {
      expect(
        service.itemFromForm({ condition: 'NEAR_MINT', language: 'FRENCH' }),
      ).toEqual({ condition: 'NEAR_MINT', language: 'FRENCH' });
    });

    it('envoie la note d’une carte gradée en nombre', () => {
      expect(
        service.itemFromForm({
          gradingCompany: 'PSA',
          grade: '9.5',
          reverse: 'true',
        }),
      ).toEqual({ gradingCompany: 'PSA', grade: 9.5, reverse: true });
    });

    it('n’envoie pas les champs vides', () => {
      expect(
        service.itemFromForm({
          condition: '',
          language: '',
          gradingCompany: '',
        }),
      ).toEqual({});
    });
  });

  it('refuse un ajout sans organisation courante', () => {
    let error: Error | undefined;

    service.add('pr1', {}).subscribe({ error: (e: Error) => (error = e) });

    expect(error?.message).toBe('Aucune organisation sélectionnée.');
  });
});
