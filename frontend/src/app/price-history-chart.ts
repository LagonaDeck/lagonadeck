import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { formatPrice } from './catalog';

export interface PricePoint {
  date: string;
  trend: string | null;
  low: string | null;
}

interface Series {
  key: 'trend' | 'low';
  label: string;
}

const SERIES: Series[] = [
  { key: 'trend', label: 'Tendance' },
  { key: 'low', label: 'Prix le plus bas' },
];

const HEIGHT = 240;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 64 };
const TICKS = 4;

// Pas « rond » (1, 2, 2,5 ou 5 × 10ⁿ) pour des graduations lisibles.
function niceStep(range: number): number {
  const raw = range / TICKS;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((f) => f * power >= raw) ?? 10;
  return step * power;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });

/** Courbes du Price Trend et du prix le plus bas, un relevé par jour. */
@Component({
  selector: 'app-price-history-chart',
  template: `
    @if (points().length < 2) {
      <p class="hint">
        @if (points().length === 1) {
          Premier relevé le {{ dateLabel(points()[0].date) }} :
          {{ formatPrice(points()[0].trend) }}. La courbe se trace à partir du
          deuxième jour, avec un relevé par jour.
        } @else {
          Pas encore de relevé : la courbe apparaîtra avec le prochain prix
          Cardmarket.
        }
      </p>
    } @else {
      <ul class="legend">
        @for (series of series; track series.key) {
          <li><span class="key {{ series.key }}"></span>{{ series.label }}</li>
        }
      </ul>
      <div class="plot">
        <svg
          [attr.width]="width()"
          [attr.height]="height"
          role="img"
          tabindex="0"
          [attr.aria-label]="summary()"
          (pointermove)="hover($event)"
          (pointerleave)="active.set(null)"
          (keydown)="step($event)"
          (blur)="active.set(null)"
        >
          @for (tick of yTicks(); track tick.value) {
            <line
              class="grid"
              [attr.x1]="margin.left"
              [attr.x2]="width() - margin.right"
              [attr.y1]="tick.y"
              [attr.y2]="tick.y"
            />
            <text class="axis" [attr.x]="margin.left - 8" [attr.y]="tick.y">
              {{ tick.label }}
            </text>
          }
          @for (tick of xTicks(); track tick.x) {
            <text
              class="axis x"
              [attr.x]="tick.x"
              [attr.y]="height - 8"
              [attr.text-anchor]="tick.anchor"
            >
              {{ tick.label }}
            </text>
          }
          <path class="area" [attr.d]="areaPath()" />
          @for (series of series; track series.key) {
            <path class="line {{ series.key }}" [attr.d]="linePath(series)" />
          }
          @if (active(); as index) {
            <line
              class="crosshair"
              [attr.x1]="x(index)"
              [attr.x2]="x(index)"
              [attr.y1]="margin.top"
              [attr.y2]="height - margin.bottom"
            />
          }
          @for (series of series; track series.key) {
            @if (marker(series); as point) {
              <circle
                class="dot {{ series.key }}"
                [attr.cx]="point.x"
                [attr.cy]="point.y"
                r="4"
              />
            }
          }
        </svg>
        @if (active() !== null && tooltip(); as tip) {
          <div class="tooltip" [style.left.px]="tip.x" role="status">
            <p class="tip-date">{{ tip.date }}</p>
            @for (row of tip.rows; track row.label) {
              <p>
                <span class="key {{ row.key }}"></span>
                <strong>{{ row.value }}</strong> {{ row.label }}
              </p>
            }
          </div>
        }
      </div>
      <details>
        <summary>Voir les relevés</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Jour</th>
              <th scope="col">Tendance</th>
              <th scope="col">Prix le plus bas</th>
            </tr>
          </thead>
          <tbody>
            @for (point of reversed(); track point.date) {
              <tr>
                <td>{{ dateLabel(point.date) }}</td>
                <td>{{ formatPrice(point.trend) }}</td>
                <td>{{ formatPrice(point.low) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </details>
    }
  `,
  styles: `
    :host {
      --series-trend: light-dark(#2a78d6, #3987e5);
      --series-low: light-dark(#eb6834, #d95926);
      display: block;
      /* La largeur vient du conteneur, jamais du SVG qu'on redimensionne. */
      contain: inline-size;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
      margin: 0 0 0.5rem;
      padding: 0;
      color: var(--slate);
      font-size: 0.85rem;
      list-style: none;
    }

    .legend li,
    .tooltip p {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .key {
      display: inline-block;
      width: 14px;
      height: 2px;
      border-radius: 1px;
      background: var(--series-trend);
    }

    .key.low {
      background: var(--series-low);
    }

    .plot {
      position: relative;
    }

    svg {
      display: block;
      overflow: visible;
      touch-action: pan-y;
    }

    svg:focus-visible {
      outline-offset: 4px;
    }

    .grid {
      stroke: var(--rule);
      stroke-width: 1;
    }

    .axis {
      fill: var(--slate);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      text-anchor: end;
      dominant-baseline: middle;
    }

    .axis.x {
      dominant-baseline: auto;
    }

    .area {
      fill: var(--series-trend);
      opacity: 0.1;
    }

    .line {
      fill: none;
      stroke: var(--series-trend);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .line.low {
      stroke: var(--series-low);
    }

    .crosshair {
      stroke: var(--slate);
      stroke-width: 1;
    }

    .dot {
      fill: var(--series-trend);
      stroke: var(--surface);
      stroke-width: 2;
    }

    .dot.low {
      fill: var(--series-low);
    }

    .tooltip {
      position: absolute;
      top: 0;
      z-index: 2;
      display: grid;
      gap: 0.15rem;
      min-width: 11rem;
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--rule);
      border-radius: 0.5rem;
      background: var(--surface);
      box-shadow: 0 8px 20px -12px var(--shadow);
      font-size: 0.85rem;
      pointer-events: none;
      transform: translateX(-50%);
    }

    .tooltip strong {
      font-variant-numeric: tabular-nums;
    }

    .tip-date {
      color: var(--slate);
    }

    details {
      margin-top: 0.75rem;
      font-size: 0.85rem;
    }

    summary {
      color: var(--slate);
      cursor: pointer;
    }

    table {
      width: 100%;
      margin-top: 0.5rem;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }

    th,
    td {
      padding: 0.3rem 0.5rem;
      border-bottom: 1px solid var(--rule);
      text-align: right;
    }

    th:first-child,
    td:first-child {
      text-align: left;
    }

    th {
      color: var(--slate);
      font-weight: 700;
    }
  `,
})
export class PriceHistoryChart {
  readonly points = input.required<PricePoint[]>();
  readonly series = SERIES;
  readonly margin = MARGIN;
  readonly height = HEIGHT;
  readonly formatPrice = formatPrice;
  readonly width = signal(640);
  readonly active = signal<number | null>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) =>
        this.width.set(Math.max(280, Math.floor(entry.contentRect.width))),
      );
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private readonly values = computed(() =>
    this.points().flatMap((point) =>
      [point.trend, point.low].filter((v) => v !== null).map(Number),
    ),
  );

  private readonly domain = computed(() => {
    const values = this.values();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = min === max ? Math.max(1, max * 0.1) : 0;
    const step = niceStep(max - min + 2 * pad);
    return {
      min: Math.max(0, Math.floor((min - pad) / step) * step),
      max: Math.ceil((max + pad) / step) * step,
      step,
    };
  });

  private readonly times = computed(() =>
    this.points().map((point) => Date.parse(`${point.date}T00:00:00Z`)),
  );

  x(index: number): number {
    const times = this.times();
    const first = times[0];
    const span = times[times.length - 1] - first || 1;
    const inner = this.width() - MARGIN.left - MARGIN.right;
    return MARGIN.left + ((times[index] - first) / span) * inner;
  }

  private y(value: number): number {
    const { min, max } = this.domain();
    const inner = HEIGHT - MARGIN.top - MARGIN.bottom;
    return MARGIN.top + (1 - (value - min) / (max - min)) * inner;
  }

  readonly yTicks = computed(() => {
    const { min, max, step } = this.domain();
    const ticks = [];
    for (let value = min; value <= max + step / 2; value += step) {
      ticks.push({ value, y: this.y(value), label: formatPrice(value) });
    }
    return ticks;
  });

  readonly xTicks = computed(() => {
    const points = this.points();
    const last = points.length - 1;
    const indexes = last >= 2 ? [0, Math.round(last / 2), last] : [0, last];
    return indexes.map((index, position) => ({
      x: this.x(index),
      label: shortDate(points[index].date),
      anchor: position === 0 ? 'start' : index === last ? 'end' : 'middle',
    }));
  });

  // Un relevé sans valeur coupe la ligne au lieu de la relier par-dessus le trou.
  linePath(series: Series): string {
    let path = '';
    let drawing = false;
    this.points().forEach((point, index) => {
      const value = point[series.key];
      if (value === null) {
        drawing = false;
        return;
      }
      path += `${drawing ? 'L' : 'M'}${this.x(index)},${this.y(Number(value))}`;
      drawing = true;
    });
    return path;
  }

  readonly areaPath = computed(() => {
    const line = this.linePath(SERIES[0]);
    const indexes = this.points()
      .map((point, index) => (point.trend === null ? -1 : index))
      .filter((index) => index >= 0);
    if (!line || indexes.length < 2 || line.lastIndexOf('M') > 0) return '';
    const baseline = this.y(this.domain().min);
    return `${line}L${this.x(indexes[indexes.length - 1])},${baseline}L${this.x(indexes[0])},${baseline}Z`;
  });

  marker(series: Series): { x: number; y: number } | null {
    const index = this.active() ?? this.points().length - 1;
    const value = this.points()[index]?.[series.key];
    return value === null || value === undefined
      ? null
      : { x: this.x(index), y: this.y(Number(value)) };
  }

  readonly tooltip = computed(() => {
    const index = this.active();
    if (index === null) return null;
    const point = this.points()[index];
    return {
      x: this.x(index),
      date: this.dateLabel(point.date),
      rows: SERIES.map((series) => ({
        key: series.key,
        label: series.label,
        value: formatPrice(point[series.key]),
      })),
    };
  });

  readonly summary = computed(() => {
    const points = this.points();
    const first = points[0];
    const last = points[points.length - 1];
    return `Tendance du ${this.dateLabel(first.date)} au ${this.dateLabel(last.date)} : de ${formatPrice(first.trend)} à ${formatPrice(last.trend)}. Flèches gauche et droite pour parcourir les relevés.`;
  });

  readonly reversed = computed(() => [...this.points()].reverse());

  // Le réticule va au relevé le plus proche du pointeur.
  hover(event: PointerEvent): void {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const pointer = event.clientX - box.left;
    let nearest = 0;
    this.points().forEach((_, index) => {
      if (
        Math.abs(this.x(index) - pointer) < Math.abs(this.x(nearest) - pointer)
      ) {
        nearest = index;
      }
    });
    this.active.set(nearest);
  }

  step(event: KeyboardEvent): void {
    const last = this.points().length - 1;
    const current = this.active() ?? last;
    if (event.key === 'ArrowLeft') this.active.set(Math.max(0, current - 1));
    else if (event.key === 'ArrowRight') {
      this.active.set(Math.min(last, current + 1));
    } else return;
    event.preventDefault();
  }

  dateLabel(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-CH', {
      timeZone: 'UTC',
    });
  }
}
