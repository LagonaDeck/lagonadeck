import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-coming-soon',
  imports: [RouterLink],
  template: `
    <main>
      <a routerLink="/"><img src="logo-wide.png" alt="LagonaDeck" /></a>
      <p>Cette page arrive bientôt.</p>
      <a routerLink="/">Retour à l'accueil</a>
    </main>
  `,
  styles: `
    main {
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 1.5rem;
      min-height: 100vh;
      padding: 1rem;
      text-align: center;
    }
    img {
      width: min(20rem, 80vw);
    }
  `,
})
export class ComingSoon {}
