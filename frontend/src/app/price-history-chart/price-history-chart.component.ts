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
import { formatPrice } from '../utils/format.util';
import { PricePoint } from '../models/product';

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
  templateUrl: './price-history-chart.component.html',
  styleUrl: './price-history-chart.component.css',
})
export class PriceHistoryChartComponent {
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
