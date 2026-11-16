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
  LucideLayoutDashboard,
  LucideLogOut,
  LucideMail,
  LucidePackage,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideFlag,
  LucideShieldCheck,
  LucideShoppingCart,
  LucideUserCog,
} from '@lucide/angular';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import {
  AccountDialogComponent,
  AccountSection,
} from '../account-dialog/account-dialog.component';
import { AuthService } from '../services/auth.service';
import { OrganizationService } from '../services/organization.service';
import { organizationInitials, roleLabel } from '../models/organization';

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
    AccountDialogComponent,
    LucideBuilding,
    LucideCheck,
    LucideChevronsUpDown,
    LucideLayoutDashboard,
    LucideLogOut,
    LucideMail,
    LucidePackage,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucideFlag,
    LucideShieldCheck,
    LucideShoppingCart,
    LucideUserCog,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  host: {
    '[class.collapsed]': 'collapsed()',
    '(document:click)': 'closeMenus($event.target)',
    '(document:keydown.escape)': 'closeMenus(null)',
  },
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  readonly organizations = inject(OrganizationService);
  readonly current = this.organizations.current;
  readonly orgInitials = organizationInitials;
  readonly role = roleLabel;
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly accountDialog = viewChild.required(AccountDialogComponent);

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
