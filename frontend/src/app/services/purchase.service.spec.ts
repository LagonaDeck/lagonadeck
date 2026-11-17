import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CardmarketPrices, Product } from '../models/product';
import { PurchaseDraftLine } from '../models/purchase';
import { OrganizationService } from './organization.service';
import { PurchaseService } from './purchase.service';

const cardmarket: CardmarketPrices = {
  id: 1,
  name: 'Prinplup',
  categoryName: 'Pokémon Single',
  trend: '2.00',
  low: null,
  avg1: null,
  avg7: null,
  avg30: null,
  trendHolo: '5.00',
  priceDate: null,
};

const product: Product = {
  id: 'pr1',
  source: 'TCGDEX',
  productType: 'SINGLE',
  tcgdexId: null,
  name: 'Pingoléon',
  englishName: null,
  setCode: 'SV',
  setName: null,
  cardNumber: '27',
  rarity: null,
  imageUrl: null,
  hasReverse: true,
  moves: [],
  cardmarket,
  cardmarketLinkedByUser: false,
  price: '2.00',
  priceUpdatedAt: null,
};

const line = (values: Partial<PurchaseDraftLine>): PurchaseDraftLine => ({
  item: { product, condition: 'NEAR_MINT' },
  quantity: 1,
  unitCost: null,
  ...values,
});

describe('PurchaseService', () => {
  let service: PurchaseService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PurchaseService);
    http = TestBed.inject(HttpTestingController);
  });

  describe('unitPrice', () => {
    it('vaut le Price Trend du produit pour une carte brute', () => {
      expect(service.unitPrice({ product })).toBe(2);
    });

    it('vaut le Price Trend reverse pour une reverse', () => {
      expect(service.unitPrice({ product, reverse: true })).toBe(5);
    });

    it('ne valorise pas une carte gradée', () => {
      expect(
        service.unitPrice({ product, gradingCompany: 'PSA', grade: 9 }),
      ).toBeNull();
    });

    it('ne valorise pas un produit sans prix ou à zéro', () => {
      expect(service.unitPrice({ product: { ...product, price: null } })).toBe(
        null,
      );
      expect(service.unitPrice({ product: { ...product, price: '0' } })).toBe(
        null,
      );
    });
  });

  it('compte les exemplaires et leur valeur, quantité comprise', () => {
    const lines = [
      line({ quantity: 3 }),
      line({ item: { product, reverse: true }, quantity: 2 }),
      line({ item: { product, gradingCompany: 'PSA', grade: 10 } }),
    ];

    expect(service.itemCount(lines)).toBe(6);
    expect(service.marketValue(lines)).toBe(3 * 2 + 2 * 5);
  });

  describe('create', () => {
    it('envoie les montants en nombres, sans les champs laissés vides', () => {
      TestBed.inject(OrganizationService).list.set([
        { id: 'o1', name: 'Test', plan: 'DISCOVERY', groups: [] },
      ]);

      service
        .create(
          {
            supplier: 'Vinted',
            purchasedAt: '2026-11-01',
            price: '8',
            fees: '',
            notes: '',
          },
          [line({ quantity: 2 }), line({ unitCost: 1.5 })],
        )
        .subscribe();

      const request = http.expectOne('/api/organizations/o1/purchases');
      expect(request.request.body).toEqual({
        supplier: 'Vinted',
        purchasedAt: '2026-11-01',
        price: 8,
        fees: 0,
        lines: [
          {
            productId: 'pr1',
            condition: 'NEAR_MINT',
            language: undefined,
            gradingCompany: undefined,
            grade: undefined,
            reverse: undefined,
            quantity: 2,
          },
          {
            productId: 'pr1',
            condition: 'NEAR_MINT',
            language: undefined,
            gradingCompany: undefined,
            grade: undefined,
            reverse: undefined,
            quantity: 1,
            unitCost: 1.5,
          },
        ],
      });
    });

    it('échoue sans organisation courante, sans appeler l’API', () => {
      let error: Error | undefined;

      service
        .create({}, [line({})])
        .subscribe({ error: (e: Error) => (error = e) });

      expect(error?.message).toBe('Aucune organisation sélectionnée.');
      http.verify();
    });
  });
});
