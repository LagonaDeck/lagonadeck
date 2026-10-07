import { Component, inject, input } from '@angular/core';
import { Theme, ThemeChoice } from './theme';

interface Palette {
  background: string;
  sidebar: string;
  surface: string;
  line: string;
  text: string;
  accent: string;
}

const LIGHT: Palette = {
  background: '#f4f6fb',
  sidebar: '#0f1535',
  surface: '#ffffff',
  line: '#d9deeb',
  text: '#0f1535',
  accent: '#1f6bff',
};

const DARK: Palette = {
  background: '#0b1020',
  sidebar: '#060914',
  surface: '#161c34',
  line: '#2b3355',
  text: '#e4e8f5',
  accent: '#5b8cff',
};

// Squelette du site (menu, header, contenu) dessiné dans un viewBox 160 × 100.
@Component({
  selector: 'g[appSkeleton]',
  template: `
    <svg:rect width="160" height="100" [attr.fill]="palette().background" />
    <svg:rect width="34" height="100" [attr.fill]="palette().sidebar" />
    <svg:rect x="5" y="4" width="7" height="7" rx="1.5" fill="#17d4c4" />
    <svg:rect
      x="15"
      y="6.5"
      width="14"
      height="2"
      rx="1"
      fill="#fff"
      opacity="0.6"
    />
    @for (y of [20, 27, 34]; track y) {
      <svg:rect
        x="5"
        [attr.y]="y"
        width="24"
        height="3"
        rx="1.5"
        fill="#fff"
        opacity="0.15"
      />
    }
    <svg:rect x="34" width="126" height="14" [attr.fill]="palette().surface" />
    <svg:rect
      x="34"
      y="14"
      width="126"
      height="0.6"
      [attr.fill]="palette().line"
    />
    <svg:circle cx="150" cy="7" r="4" [attr.fill]="palette().accent" />
    <svg:rect
      x="42"
      y="21"
      width="40"
      height="5"
      rx="1.5"
      [attr.fill]="palette().text"
    />
    <svg:rect
      x="42"
      y="30"
      width="72"
      height="2.5"
      rx="1.25"
      [attr.fill]="palette().line"
    />
    <svg:rect
      x="42"
      y="39"
      width="110"
      height="52"
      rx="3"
      [attr.fill]="palette().surface"
      [attr.stroke]="palette().line"
      stroke-width="0.6"
    />
    @for (y of [48, 62, 76]; track y) {
      <svg:rect
        x="49"
        [attr.y]="y"
        width="30"
        height="2.5"
        rx="1.25"
        [attr.fill]="palette().line"
      />
      <svg:rect
        x="118"
        [attr.y]="y"
        width="27"
        height="2.5"
        rx="1.25"
        [attr.fill]="palette().text"
        opacity="0.7"
      />
    }
  `,
})
export class Skeleton {
  readonly palette = input.required<Palette>();
}

@Component({
  selector: 'app-appearance',
  imports: [Skeleton],
  template: `
    <fieldset>
      <legend>Thème</legend>
      @for (option of options; track option.value) {
        <label [class.selected]="theme.choice() === option.value">
          <svg viewBox="0 0 160 100" aria-hidden="true">
            @if (option.value === 'auto') {
              <defs>
                <clipPath id="dark-half">
                  <polygon points="160,0 160,100 0,100" />
                </clipPath>
              </defs>
              <g appSkeleton [palette]="light" />
              <g appSkeleton [palette]="dark" clip-path="url(#dark-half)" />
            } @else {
              <g
                appSkeleton
                [palette]="option.value === 'dark' ? dark : light"
              />
            }
          </svg>
          <span class="choice">
            <input
              type="radio"
              name="theme"
              [value]="option.value"
              [checked]="theme.choice() === option.value"
              (change)="theme.select(option.value)"
            />
            {{ option.label }}
          </span>
        </label>
      }
    </fieldset>
  `,
  styles: `
    fieldset {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: 1rem;
      max-width: 40rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    legend {
      margin-bottom: 1rem;
      color: var(--slate);
    }

    label {
      display: grid;
      gap: 0.6rem;
      cursor: pointer;
    }

    svg {
      display: block;
      width: 100%;
      border: 2px solid var(--rule);
      border-radius: 0.6rem;
    }

    label:hover svg {
      border-color: color-mix(in srgb, var(--ink) 30%, var(--rule));
    }

    .selected svg {
      border-color: var(--blue);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--blue) 20%, transparent);
    }

    .choice {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    input {
      accent-color: var(--blue);
    }
  `,
})
export class Appearance {
  readonly theme = inject(Theme);
  readonly light = LIGHT;
  readonly dark = DARK;
  readonly options: { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
    { value: 'auto', label: 'Automatique' },
  ];
}
