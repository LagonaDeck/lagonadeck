import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideBuilding,
  LucideLayoutDashboard,
  LucidePalette,
  LucidePlus,
  LucideShieldCheck,
  LucideUser,
  LucideUserRound,
  LucideX,
} from '@lucide/angular';
import { AppearanceComponent } from '../appearance/appearance.component';
import { AuthService } from '../services/auth.service';
import { OrganizationCreateComponent } from '../organization-create/organization-create.component';
import { OrganizationSettingsComponent } from '../organization-settings/organization-settings.component';
import { ProfileFormComponent } from '../profile-form/profile-form.component';
import { SecurityComponent } from '../security/security.component';
import { OrganizationService } from '../services/organization.service';
import { organizationInitials } from '../models/organization';

export type AccountSection = 'me' | 'organizations';

const ME_PAGES = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'profile', label: 'Mon profil' },
  { id: 'appearance', label: 'Apparence' },
  { id: 'security', label: 'Sécurité' },
] as const;

@Component({
  selector: 'app-account-dialog',
  imports: [
    AppearanceComponent,
    OrganizationCreateComponent,
    OrganizationSettingsComponent,
    ProfileFormComponent,
    SecurityComponent,
    LucideBuilding,
    LucideLayoutDashboard,
    LucidePalette,
    LucidePlus,
    LucideShieldCheck,
    LucideUser,
    LucideUserRound,
    LucideX,
  ],
  templateUrl: './account-dialog.component.html',
  styleUrl: './account-dialog.component.css',
  host: { '(click)': 'closeOnBackdrop($event.target)' },
})
export class AccountDialogComponent {
  readonly auth = inject(AuthService);
  readonly organizations = inject(OrganizationService);
  readonly mePages = ME_PAGES;
  readonly orgInitials = organizationInitials;
  readonly section = signal<AccountSection>('me');
  readonly page = signal<string>('overview');
  private readonly dialog =
    viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly sectionTitle = computed(() =>
    this.section() === 'me' ? 'Moi' : 'Mes organisations',
  );

  readonly pageTitle = computed(
    () =>
      ME_PAGES.find(({ id }) => id === this.page())?.label ??
      this.organizations.list().find(({ id }) => id === this.page())?.name ??
      (this.page() === 'new' ? 'Nouvelle organisation' : undefined) ??
      this.sectionTitle(),
  );

  readonly maxOrganizations = 3;
  readonly selectedOrganization = computed(() =>
    this.organizations.list().find(({ id }) => id === this.page()),
  );

  readonly userInitials = computed(() =>
    (this.auth.user()?.username ?? '').slice(0, 2).toUpperCase(),
  );

  constructor() {
    // Une organisation quittée ou supprimée disparaît de la liste : on passe à
    // la courante, ou à la création s'il n'en reste aucune.
    effect(() => {
      if (
        this.section() === 'organizations' &&
        this.page() !== 'new' &&
        !this.selectedOrganization()
      ) {
        this.page.set(this.organizations.current()?.id ?? 'new');
      }
    });
  }

  open(section: AccountSection): void {
    this.show(
      section,
      section === 'me' ? 'overview' : (this.organizations.current()?.id ?? ''),
    );
    this.dialog().nativeElement.showModal();
  }

  // Échap ferme déjà un <dialog> natif ; le clic sur le fond en est l'équivalent à la souris.
  closeOnBackdrop(target: EventTarget | null): void {
    const dialog = this.dialog().nativeElement;
    if (target === dialog) dialog.close();
  }

  show(section: AccountSection, page: string): void {
    this.section.set(section);
    this.page.set(page);
  }
}
