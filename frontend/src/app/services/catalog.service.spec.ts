import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CardmarketPrices } from '../models/product';
import { CatalogService } from './catalog.service';

const prices = (
  avg7: string | null,
  avg30: string | null,
): CardmarketPrices => ({
  id: 1,
  name: 'Prinplup',
  categoryName: 'Pokémon Single',
  trend: null,
  low: null,
  avg1: null,
  avg7,
  avg30,
  trendHolo: null,
  priceDate: null,
});

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
  });

  describe('priceDirection', () => {
    it('compare la moyenne 7 jours à la moyenne 30 jours', () => {
      expect(service.priceDirection(prices('2.20', '2.00'))).toBe('up');
      expect(service.priceDirection(prices('1.80', '2.00'))).toBe('down');
    });

    it('reste stable dans un écart de 2 %', () => {
      expect(service.priceDirection(prices('2.03', '2.00'))).toBe('stable');
      expect(service.priceDirection(prices('1.97', '2.00'))).toBe('stable');
    });

    it('ne donne aucune tendance sans les deux moyennes', () => {
      expect(service.priceDirection(prices(null, '2.00'))).toBeNull();
      expect(service.priceDirection(prices('2.00', null))).toBeNull();
    });
  });

  it('n’envoie pas les champs facultatifs laissés vides', () => {
    const http = TestBed.inject(HttpTestingController);

    service
      .createProduct({ name: 'Coffret', setCode: '', productType: 'BOX_SET' })
      .subscribe();

    expect(http.expectOne('/api/products').request.body).toEqual({
      name: 'Coffret',
      productType: 'BOX_SET',
    });
  });
});
