import {
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideBuilding,
  LucideCheck,
  LucideChevronsUpDown,
  LucideLogOut,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideUserCog,
} from '@lucide/angular';
import { Router } from '@angular/router';
import { AccountDialog, AccountSection } from './account-dialog';
import { Auth } from './auth';
import {
  Organizations,
  organizationInitials,
  roleLabel,
} from './organizations';

const COLLAPSED_KEY = 'sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-dashboard',
  imports: [
    AccountDialog,
    LucideBuilding,
    LucideCheck,
    LucideChevronsUpDown,
    LucideLogOut,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucideUserCog,
  ],
  template: `
    <aside class="sidebar">
      @if (current(); as current) {
        <details #switcher class="switcher">
          <summary
            [attr.aria-label]="
              'Changer d’organisation, actuelle : ' + current.name
            "
          >
            <span class="org-avatar" aria-hidden="true">{{
              orgInitials(current.name)
            }}</span>
            <span class="org-text">
              <strong [title]="current.name">{{ current.name }}</strong>
              <span>{{ role(current) }}</span>
            </span>
            <svg
              class="org-chevron"
              lucideChevronsUpDown
              [size]="16"
              aria-hidden="true"
            ></svg>
          </summary>
          <div class="org-menu">
            <ul class="org-list">
              @for (
                organization of organizations.list();
                track organization.id
              ) {
                <li>
                  <button
                    type="button"
                    [attr.aria-current]="organization.id === current.id"
                    (click)="
                      organizations.select(organization.id);
                      switcher.open = false
                    "
                  >
                    <span class="org-avatar" aria-hidden="true">{{
                      orgInitials(organization.name)
                    }}</span>
                    <span class="org-text">
                      <strong [title]="organization.name">{{
                        organization.name
                      }}</strong>
                      <span>{{ role(organization) }}</span>
                    </span>
                    @if (organization.id === current.id) {
                      <svg lucideCheck [size]="16" aria-hidden="true"></svg>
                    }
                  </button>
                </li>
              }
            </ul>
            <button
              type="button"
              class="action"
              (click)="openAccount('organizations')"
            >
              <svg lucideBuilding [size]="18" aria-hidden="true"></svg>
              Gérer mes organisations
            </button>
          </div>
        </details>
      }
      <nav aria-label="Navigation principale"></nav>
      <button
        type="button"
        class="collapse"
        [attr.aria-label]="collapsed() ? 'Agrandir le menu' : 'Réduire le menu'"
        [attr.aria-expanded]="!collapsed()"
        (click)="toggleSidebar()"
      >
        @if (collapsed()) {
          <svg lucidePanelLeftOpen [size]="20" aria-hidden="true"></svg>
        } @else {
          <svg lucidePanelLeftClose [size]="20" aria-hidden="true"></svg>
        }
      </button>
    </aside>

    <header class="topbar">
      <details class="account">
        <summary
          class="avatar"
          [attr.aria-label]="'Compte de ' + auth.user()?.username"
        >
          {{ initials() }}
        </summary>
        <div class="menu">
          <div class="identity">
            <span class="avatar large" aria-hidden="true">{{
              initials()
            }}</span>
            <p>
              <strong>{{ auth.user()?.username }}</strong>
              <span>{{ auth.user()?.email }}</span>
            </p>
          </div>
          <button type="button" class="action" (click)="openAccount('me')">
            <svg lucideUserCog [size]="18" aria-hidden="true"></svg>
            Gérer mon compte
          </button>
          <button type="button" class="action logout" (click)="logout()">
            <svg lucideLogOut [size]="18" aria-hidden="true"></svg>
            Déconnexion
          </button>
        </div>
      </details>
    </header>

    <main class="content">
      <h1>Tableau de bord</h1>
      <p class="empty">Vos lots, votre stock et vos ventes apparaîtront ici.</p>
    </main>

    <app-account-dialog />
  `,
  styleUrl: './dashboard.css',
  host: {
    '[class.collapsed]': 'collapsed()',
    '(document:click)': 'closeMenus($event.target)',
    '(document:keydown.escape)': 'closeMenus(null)',
  },
})
export class Dashboard {
  readonly auth = inject(Auth);
  readonly organizations = inject(Organizations);
  readonly current = this.organizations.current;
  readonly orgInitials = organizationInitials;
  readonly role = roleLabel;
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly accountDialog = viewChild.required(AccountDialog);

  constructor() {
    this.organizations.load().subscribe();
  }
  readonly collapsed = signal(readCollapsed());

  // Les menus sont des <details> natifs : rien ne les ferme d'un clic ailleurs.
  closeMenus(target: EventTarget | null): void {
    this.host.nativeElement
      .querySelectorAll<HTMLDetailsElement>('details[open]')
      .forEach((menu) => {
        if (!(target instanceof Node && menu.contains(target)))
          menu.open = false;
      });
  }

  openAccount(section: AccountSection): void {
    this.closeMenus(null);
    this.accountDialog().open(section);
  }

  toggleSidebar(): void {
    this.collapsed.update((collapsed) => !collapsed);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(this.collapsed()));
    } catch {
      // Stockage indisponible (navigation privée) : l'état ne survit pas au rechargement.
    }
  }

  initials(): string {
    return (this.auth.user()?.username ?? '').slice(0, 2).toUpperCase();
  }

  logout(): void {
    this.auth.logout().subscribe(() => void this.router.navigate(['/login']));
  }
}
