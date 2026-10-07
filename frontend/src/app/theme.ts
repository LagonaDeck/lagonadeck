import { Injectable, effect, signal } from '@angular/core';

export type ThemeChoice = 'light' | 'dark' | 'auto';

const THEME_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly choice = signal<ThemeChoice>(readStored());

  constructor() {
    // Sans attribut, le thème suit `prefers-color-scheme` du système.
    effect(() => {
      const choice = this.choice();
      if (choice === 'auto') delete document.documentElement.dataset['theme'];
      else document.documentElement.dataset['theme'] = choice;
    });
  }

  select(choice: ThemeChoice): void {
    this.choice.set(choice);
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {
      // Stockage indisponible : le choix ne survit pas au rechargement.
    }
  }
}

function readStored(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}
