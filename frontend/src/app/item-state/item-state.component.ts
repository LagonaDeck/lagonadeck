import { Component, input } from '@angular/core';
import { ChipComponent } from '../chip/chip.component';
import {
  CONDITIONS,
  CONDITION_CODES,
  GRADING_COMPANIES,
  InventoryItem,
} from '../models/inventory-item';

/** État de l'exemplaire en puces : état Cardmarket ou gradation, et reverse. */
@Component({
  selector: 'app-item-state',
  imports: [ChipComponent],
  templateUrl: './item-state.component.html',
  styleUrl: './item-state.component.css',
})
export class ItemStateComponent {
  readonly item =
    input.required<
      Pick<InventoryItem, 'condition' | 'gradingCompany' | 'grade' | 'reverse'>
    >();
  readonly conditions = CONDITIONS;
  readonly codes = CONDITION_CODES;
  readonly gradingCompanies = GRADING_COMPANIES;
}
