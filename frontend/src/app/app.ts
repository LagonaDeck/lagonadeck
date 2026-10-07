import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Theme } from './theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Applique le thème mémorisé dès le démarrage, sur toutes les pages.
  private readonly theme = inject(Theme);
}
