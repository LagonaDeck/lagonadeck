import { Component, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { RouterLink } from '@angular/router';

const SWIPE_THRESHOLD_PX = 40;
const MAX_DRAG_PX = 80;
const LEAVE_MS = 140;

// TODO: remplacer les avis fictifs par de vrais avis clients avant la mise en ligne.
const REVIEWS = [
  {
    name: 'Daniel Baião',
    role: 'Revendeur sur Ricardo',
    rating: 5,
    attack: 'Plateformes',
    damage: 'Vendue',
    text: 'J’ai déjà vendu deux fois la même carte. Avec l’alerte, je sais tout de suite quelles annonces retirer.',
    color: 'var(--violet)',
  },
  {
    name: 'Mathieu Rais',
    role: 'Boutique à Lausanne',
    rating: 5,
    attack: 'Achat en lot',
    damage: '600 CHF',
    text: 'Je rachète des collections entières. Le prix du lot est réparti sur chaque carte et chaque ETB selon la cote.',
    color: 'var(--blue)',
  },
  {
    name: 'Keito Gerber',
    role: 'Collectionneur et revendeur',
    rating: 4,
    attack: 'Suivi du prix',
    damage: '+12 %',
    text: 'Je vois la cote de mes cartes évoluer et je vends au bon moment, plus au feeling.',
    color: 'var(--teal)',
  },
  {
    name: 'Monsieur Lagona',
    role: 'Revendeur à plein temps',
    rating: 5,
    attack: 'Capital dormant',
    damage: '143 j',
    text: 'L’alerte m’a rappelé un ETB oublié depuis des mois : 120 CHF qui dormaient dans une boîte.',
    color: 'var(--violet)',
  },
  {
    name: 'Monsieur Galli',
    role: 'Boutique en ligne',
    rating: 5,
    attack: 'Comptabilité',
    damage: '+1 840 CHF',
    text: 'Chaque mois, j’ai mon chiffre d’affaires, mes frais et ma marge nette, sans refaire mes tableurs.',
    color: 'var(--blue)',
  },
];

// TODO: remplacer les tarifs fictifs par les vrais tarifs.
const PLANS = [
  {
    name: 'Découverte',
    price: '0 CHF',
    period: 'par mois',
    featured: false,
    perks: [
      'Jusqu’à 50 articles en stock',
      'Achats en lots',
      'Plateformes de vente',
      '1 utilisateur',
    ],
  },
  {
    name: 'Revendeur',
    price: '19 CHF',
    period: 'par mois',
    featured: true,
    perks: [
      'Tout ce que contient Découverte',
      'Articles illimités',
      'Suivi du prix',
      'Achats en lots au prorata du prix du marché',
    ],
  },
  {
    name: 'Boutique',
    price: '12 CHF',
    period: 'par utilisateur et par mois',
    featured: false,
    perks: [
      'Tout ce que contient Revendeur',
      'Alertes capital dormant, achat et vente',
      'Comptabilité',
      'Minimum 5 utilisateurs',
    ],
  },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, LucideChevronLeft, LucideChevronRight],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  readonly reviews = REVIEWS;
  readonly plans = PLANS;
  readonly topReview = signal(0);
  readonly year = new Date().getFullYear();
  readonly dragX = signal(0);
  readonly leaveDirection = signal(0);
  private swipeStartX: number | null = null;

  // Le tableau n'est jamais réordonné : chaque carte garde son nœud DOM, donc sa transition.
  stackPosition(index: number): number {
    return (index - this.topReview() + REVIEWS.length) % REVIEWS.length;
  }

  moveReview(step: 1 | -1): void {
    this.topReview.update(
      (top) => (top + step + REVIEWS.length) % REVIEWS.length,
    );
  }

  startSwipe(event: PointerEvent): void {
    if (this.leaveDirection() !== 0) return;
    this.swipeStartX = event.clientX;
    // Sans capture, relâcher hors de la pile laisserait la carte en plein glissement.
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  dragSwipe(event: PointerEvent): void {
    if (this.swipeStartX === null) return;
    const distance = event.clientX - this.swipeStartX;
    this.dragX.set(Math.max(-MAX_DRAG_PX, Math.min(MAX_DRAG_PX, distance)));
  }

  endSwipe(): void {
    const distance = this.dragX();
    this.cancelSwipe();
    if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
    // La carte sort d'abord de la pile dans le sens du geste, puis passe dessous :
    // descendue tout de suite, elle repartirait à contre-sens sous les autres.
    this.leaveDirection.set(Math.sign(distance));
    setTimeout(() => {
      this.leaveDirection.set(0);
      this.moveReview(1);
    }, LEAVE_MS);
  }

  cancelSwipe(): void {
    this.swipeStartX = null;
    this.dragX.set(0);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('');
  }
}
