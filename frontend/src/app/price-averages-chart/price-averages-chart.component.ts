import { Component, computed, input } from '@angular/core';
import { CardmarketPrices } from '../models/product';
import { formatPrice } from '../utils/format.util';

interface Bar {
  label: string;
  value: number | null;
  // La tendance et le prix le plus bas gardent la couleur de leur courbe ;
  // les moyennes servent de contexte.
  tone: 'trend' | 'low' | 'context';
}

/** Prix du jour Cardmarket, du plus bas à la tendance, en barres depuis zéro. */
@Component({
  selector: 'app-price-averages-chart',
  templateUrl: './price-averages-chart.component.html',
  styleUrl: './price-averages-chart.component.css',
})
export class PriceAveragesChartComponent {
  readonly prices = input.required<CardmarketPrices>();
  readonly formatPrice = formatPrice;

  readonly bars = computed<Bar[]>(() => {
    const prices = this.prices();
    const value = (amount: string | null) =>
      amount === null ? null : Number(amount);
    return [
      { label: 'Prix le plus bas', value: value(prices.low), tone: 'low' },
      {
        label: 'Moyenne 30 jours',
        value: value(prices.avg30),
        tone: 'context',
      },
      { label: 'Moyenne 7 jours', value: value(prices.avg7), tone: 'context' },
      { label: 'Moyenne 1 jour', value: value(prices.avg1), tone: 'context' },
      { label: 'Tendance', value: value(prices.trend), tone: 'trend' },
    ];
  });

  readonly max = computed(() =>
    Math.max(1, ...this.bars().map((bar) => bar.value ?? 0)),
  );
}
