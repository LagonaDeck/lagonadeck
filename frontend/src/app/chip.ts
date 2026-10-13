import { Component, input } from '@angular/core';

/**
 * Puce courte avec son tooltip. `tone` reprend la couleur d'un état Cardmarket
 * (`NEAR_MINT`…), `flag` affiche un drapeau ; sans `tone`, la puce est neutre.
 */
@Component({
  selector: 'app-chip',
  host: { '[class]': 'tone()' },
  template: `
    <span aria-hidden="true">{{ text() }}</span>
    <span class="tooltip">{{ tooltip() }}</span>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
      min-width: 2.1rem;
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--tone, var(--rule));
      border-radius: 0.3rem;
      background: var(--tone, transparent);
      color: var(--on-tone, inherit);
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.4;
      text-align: center;
      white-space: nowrap;
      cursor: default;
    }

    :host(.MINT) {
      --tone: var(--condition-mint);
      --on-tone: #fff;
    }

    :host(.NEAR_MINT) {
      --tone: var(--condition-near-mint);
      --on-tone: #fff;
    }

    :host(.EXCELLENT) {
      --tone: var(--condition-excellent);
      --on-tone: #0f1535;
    }

    :host(.GOOD) {
      --tone: var(--condition-good);
      --on-tone: #0f1535;
    }

    :host(.LIGHT_PLAYED) {
      --tone: var(--condition-light-played);
      --on-tone: #0f1535;
    }

    :host(.PLAYED) {
      --tone: var(--condition-played);
      --on-tone: #fff;
    }

    :host(.POOR) {
      --tone: var(--condition-poor);
      --on-tone: #fff;
    }

    :host(.flag) {
      min-width: 0;
      padding: 0;
      border-color: transparent;
      font-size: 1.25rem;
      line-height: 1;
    }

    /* Toujours lu par un lecteur d'écran, affiché au survol. */
    .tooltip {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      z-index: 3;
      padding: 0.3rem 0.55rem;
      border-radius: 0.4rem;
      background: var(--ink);
      color: var(--surface);
      font-size: 0.8rem;
      font-weight: 400;
      opacity: 0;
      pointer-events: none;
      transform: translate(-50%, 2px);
      transition:
        opacity 0.12s,
        transform 0.12s;
    }

    :host(:hover) .tooltip {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  `,
})
export class Chip {
  readonly text = input.required<string>();
  readonly tooltip = input.required<string>();
  readonly tone = input('');
}
