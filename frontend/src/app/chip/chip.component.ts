import { Component, input } from '@angular/core';

/**
 * Puce courte avec son tooltip. `tone` reprend la couleur d'un état Cardmarket
 * (`NEAR_MINT`…), `flag` affiche un drapeau ; sans `tone`, la puce est neutre.
 */
@Component({
  selector: 'app-chip',
  host: { '[class]': 'tone()' },
  templateUrl: './chip.component.html',
  styleUrl: './chip.component.css',
})
export class ChipComponent {
  readonly text = input.required<string>();
  readonly tooltip = input.required<string>();
  readonly tone = input('');
}
