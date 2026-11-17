import { Component, inject } from '@angular/core';
import { ThemeService } from '../services/theme.service';
import { ThemeChoice } from '../models/theme-choice';
import { Palette, SkeletonComponent } from '../skeleton/skeleton.component';

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

@Component({
  selector: 'app-appearance',
  imports: [SkeletonComponent],
  templateUrl: './appearance.component.html',
  styleUrl: './appearance.component.css',
})
export class AppearanceComponent {
  readonly theme = inject(ThemeService);
  readonly light = LIGHT;
  readonly dark = DARK;
  readonly options: { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
    { value: 'auto', label: 'Automatique' },
  ];
}
