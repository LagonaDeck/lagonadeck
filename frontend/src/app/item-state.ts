import { Component, input } from '@angular/core';
import { Chip } from './chip';
import {
  CONDITIONS,
  CONDITION_CODES,
  GRADING_COMPANIES,
  InventoryItem,
} from './catalog';

/** État de l'exemplaire en puces : état Cardmarket ou gradation, et reverse. */
@Component({
  selector: 'app-item-state',
  imports: [Chip],
  template: `
    @if (item().gradingCompany; as company) {
      <app-chip
        [text]="gradingCompanies[company] + ' ' + item().grade"
        [tooltip]="
          'Gradée par ' + gradingCompanies[company] + ', note ' + item().grade
        "
      />
    } @else if (item().condition; as condition) {
      <app-chip
        [text]="codes[condition]"
        [tooltip]="conditions[condition]"
        [tone]="condition"
      />
    } @else {
      —
    }
    @if (item().reverse) {
      <app-chip
        text="Reverse"
        tooltip="Version reverse, au prix reverse de Cardmarket"
      />
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
    }
  `,
})
export class ItemState {
  readonly item =
    input.required<
      Pick<InventoryItem, 'condition' | 'gradingCompany' | 'grade' | 'reverse'>
    >();
  readonly conditions = CONDITIONS;
  readonly codes = CONDITION_CODES;
  readonly gradingCompanies = GRADING_COMPANIES;
}
