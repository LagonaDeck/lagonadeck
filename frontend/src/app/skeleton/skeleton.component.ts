import { Component, input } from '@angular/core';

export interface Palette {
  background: string;
  sidebar: string;
  surface: string;
  line: string;
  text: string;
  accent: string;
}

// Squelette du site (menu, header, contenu) dessiné dans un viewBox 160 × 100.
@Component({
  selector: 'g[appSkeleton]',
  templateUrl: './skeleton.component.html',
})
export class SkeletonComponent {
  readonly palette = input.required<Palette>();
}
