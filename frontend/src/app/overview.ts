import { Component } from '@angular/core';

@Component({
  selector: 'app-overview',
  template: `
    <h1>Tableau de bord</h1>
    <p class="empty">Vos lots, votre stock et vos ventes apparaîtront ici.</p>
  `,
  styles: `
    h1 {
      font-size: clamp(1.75rem, 3vw, 2.25rem);
    }

    .empty {
      margin-top: 0.75rem;
      color: var(--slate);
    }
  `,
})
export class Overview {}
