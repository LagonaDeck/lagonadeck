import { Component, computed, input } from '@angular/core';
import { CardmarketPrices, formatPrice } from './catalog';

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
  template: `
    <ul class="bars">
      @for (bar of bars(); track bar.label) {
        <li>
          <span class="label">{{ bar.label }}</span>
          <span class="value">{{ formatPrice(bar.value) }}</span>
          <span class="track" aria-hidden="true">
            @if (bar.value !== null) {
              <span
                class="bar {{ bar.tone }}"
                [style.width.%]="(bar.value / max()) * 100"
              ></span>
            }
          </span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      --series-trend: light-dark(#2a78d6, #3987e5);
      --series-low: light-dark(#eb6834, #d95926);
      --context: light-dark(#c3c8d6, #4a5275);
      display: block;
    }

    .bars {
      display: grid;
      gap: 0.55rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.25rem 0.75rem;
      font-size: 0.85rem;
    }

    .label {
      color: var(--slate);
    }

    .value {
      font-variant-numeric: tabular-nums;
    }

    .track {
      grid-column: 1 / -1;
      height: 14px;
    }

    .bar {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: 0 4px 4px 0;
      background: var(--context);
    }

    .bar.trend {
      background: var(--series-trend);
    }

    .bar.low {
      background: var(--series-low);
    }
  `,
})
export class PriceAveragesChart {
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
