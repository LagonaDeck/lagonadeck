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
import { Appearance } from './appearance';
import { Auth } from './auth';
import { OrganizationCreate } from './organization-create';
import { OrganizationSettings } from './organization-settings';
import { ProfileForm } from './profile-form';
import { Security } from './security';
import { Organizations, organizationInitials } from './organizations';

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
    Appearance,
    OrganizationCreate,
    OrganizationSettings,
    ProfileForm,
    Security,
    LucideBuilding,
    LucideLayoutDashboard,
    LucidePalette,
    LucidePlus,
    LucideShieldCheck,
    LucideUser,
    LucideUserRound,
    LucideX,
  ],
  template: `
    <dialog #dialog aria-labelledby="account-dialog-title">
      <div class="layout">
        <nav class="rail" aria-label="Sections">
          <button
            type="button"
            aria-label="Moi"
            title="Moi"
            [attr.aria-current]="section() === 'me'"
            (click)="show('me', 'overview')"
          >
            <svg lucideUser [size]="20" aria-hidden="true"></svg>
          </button>
          <button
            type="button"
            aria-label="Mes organisations"
            title="Mes organisations"
            [attr.aria-current]="section() === 'organizations'"
            (click)="show('organizations', organizations.current()?.id ?? '')"
          >
            <svg lucideBuilding [size]="20" aria-hidden="true"></svg>
          </button>
        </nav>

        <nav class="pages" [attr.aria-label]="sectionTitle()">
          <h2>{{ sectionTitle() }}</h2>
          <ul>
            @if (section() === 'me') {
              @for (item of mePages; track item.id) {
                <li>
                  <button
                    type="button"
                    [attr.aria-current]="page() === item.id"
                    (click)="page.set(item.id)"
                  >
                    @switch (item.id) {
                      @case ('overview') {
                        <svg
                          lucideLayoutDashboard
                          [size]="18"
                          aria-hidden="true"
                        ></svg>
                      }
                      @case ('profile') {
                        <svg
                          lucideUserRound
                          [size]="18"
                          aria-hidden="true"
                        ></svg>
                      }
                      @case ('appearance') {
                        <svg lucidePalette [size]="18" aria-hidden="true"></svg>
                      }
                      @case ('security') {
                        <svg
                          lucideShieldCheck
                          [size]="18"
                          aria-hidden="true"
                        ></svg>
                      }
                    }
                    {{ item.label }}
                  </button>
                </li>
              }
            } @else {
              @for (
                organization of organizations.list();
                track organization.id
              ) {
                <li>
                  <button
                    type="button"
                    [attr.aria-current]="page() === organization.id"
                    (click)="page.set(organization.id)"
                  >
                    <span class="org-avatar" aria-hidden="true">{{
                      orgInitials(organization.name)
                    }}</span>
                    <span class="clamp" [title]="organization.name">{{
                      organization.name
                    }}</span>
                  </button>
                </li>
              }
            }
          </ul>
          @if (section() === 'organizations') {
            <button
              type="button"
              class="create"
              [attr.aria-current]="page() === 'new'"
              [disabled]="organizations.list().length >= maxOrganizations"
              [title]="
                organizations.list().length >= maxOrganizations
                  ? 'Vous faites déjà partie de 3 organisations, le maximum'
                  : ''
              "
              (click)="page.set('new')"
            >
              <svg lucidePlus [size]="18" aria-hidden="true"></svg>
              Créer une nouvelle organisation
            </button>
          }
        </nav>

        <section class="content">
          <header>
            <h1 id="account-dialog-title">{{ pageTitle() }}</h1>
            <button
              type="button"
              class="close"
              aria-label="Fermer"
              (click)="dialog.close()"
            >
              <svg lucideX [size]="20" aria-hidden="true"></svg>
            </button>
          </header>

          @if (page() === 'overview') {
            <div class="identity">
              <span class="avatar" aria-hidden="true">{{
                userInitials()
              }}</span>
              <p>
                <strong>{{ auth.user()?.username }}</strong>
                <span>{{ auth.user()?.email }}</span>
              </p>
            </div>
          } @else if (page() === 'profile') {
            <app-profile-form />
          } @else if (page() === 'appearance') {
            <app-appearance />
          } @else if (page() === 'security') {
            <app-security />
          } @else if (page() === 'new') {
            <app-organization-create
              (created)="page.set($event.id)"
              (cancelled)="
                show('organizations', organizations.current()?.id ?? '')
              "
            />
          } @else if (selectedOrganization(); as organization) {
            <app-organization-settings [organization]="organization" />
          } @else {
            <p class="soon">Cette page arrive bientôt.</p>
          }
        </section>
      </div>
    </dialog>
  `,
  styleUrl: './account-dialog.css',
  host: { '(click)': 'closeOnBackdrop($event.target)' },
})
export class AccountDialog {
  readonly auth = inject(Auth);
  readonly organizations = inject(Organizations);
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
