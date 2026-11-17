import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent {
  // Applique le thème mémorisé dès le démarrage, sur toutes les pages.
  private readonly theme = inject(ThemeService);
}
