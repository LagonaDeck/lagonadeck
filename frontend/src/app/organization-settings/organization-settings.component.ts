import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LucideCheck, LucidePencil, LucideX } from '@lucide/angular';
import { errorMessage, formValues } from '../utils/form.util';
import { OrganizationGroupsComponent } from '../organization-groups/organization-groups.component';
import { OrganizationMembersComponent } from '../organization-members/organization-members.component';
import {
  Organization,
  organizationInitials,
  planLabel,
  roleLabel,
} from '../models/organization';
import { OrganizationService } from '../services/organization.service';

type Tab = 'general' | 'members' | 'groups';

const DELETE_CONFIRMATION =
  'Je confirme que je veux supprimer mon organisation';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'Général' },
  { id: 'members', label: 'Membres' },
  { id: 'groups', label: 'Groupes' },
];

@Component({
  selector: 'app-organization-settings',
  imports: [
    LucideCheck,
    LucidePencil,
    LucideX,
    OrganizationGroupsComponent,
    OrganizationMembersComponent,
  ],
  templateUrl: './organization-settings.component.html',
  styleUrl: './organization-settings.component.css',
})
export class OrganizationSettingsComponent {
  private readonly organizations = inject(OrganizationService);
  readonly organization = input.required<Organization>();
  readonly tabs = TABS;
  readonly tab = signal<Tab>('general');
  readonly editing = signal(false);
  readonly pending = signal(false);
  readonly error = signal('');
  readonly confirmationPhrase = DELETE_CONFIRMATION;
  readonly deleteStep = signal<'idle' | 'name' | 'phrase'>('idle');
  readonly typed = signal('');
  private readonly confirmField =
    viewChild<ElementRef<HTMLInputElement>>('confirmField');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  readonly access = this.organizations.access(() => this.organization().id);
  readonly permissions = computed(() =>
    this.access.hasValue() ? this.access.value().permissions : [],
  );
  readonly canManage = computed(() =>
    this.organizations.canManage(this.permissions()),
  );
  readonly plan = computed(() => planLabel(this.organization().plan));
  readonly initials = computed(() =>
    organizationInitials(this.organization().name),
  );
  readonly role = computed(() => roleLabel(this.organization()));
  readonly isOwner = computed(() =>
    this.organizations.isOwner(this.organization()),
  );

  constructor() {
    effect(() => this.field()?.nativeElement.select());
    effect(() => this.confirmField()?.nativeElement.focus());
    // Changer d'organisation repart de l'onglet Général, sans saisie en cours.
    effect(() => {
      this.organization();
      this.tab.set('general');
      this.editing.set(false);
      this.deleteStep.set('idle');
      this.typed.set('');
      this.error.set('');
    });
  }

  edit(): void {
    this.error.set('');
    this.editing.set(true);
  }

  // Échap annule la modification sans fermer la modale qui contient la page.
  cancel(event?: Event): void {
    event?.preventDefault();
    this.error.set('');
    this.editing.set(false);
  }

  nextDeleteStep(): void {
    this.typed.set('');
    this.deleteStep.set('phrase');
  }

  // Échap annule la suppression sans fermer la modale qui contient la page.
  cancelDelete(event?: Event): void {
    event?.preventDefault();
    this.typed.set('');
    this.deleteStep.set('idle');
  }

  deleteOrganization(): void {
    this.pending.set(true);
    this.error.set('');
    this.organizations.delete(this.organization().id).subscribe({
      next: () => this.pending.set(false),
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }

  rename(event: SubmitEvent): void {
    const { name } = formValues(event) as { name: string };
    this.pending.set(true);
    this.organizations.rename(this.organization().id, name).subscribe({
      next: () => {
        this.pending.set(false);
        this.editing.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.pending.set(false);
        this.error.set(errorMessage(error));
      },
    });
  }
}
