import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { LucideBell } from '@lucide/angular';
import { ReceivedInvitation } from '../models/invitation';
import { InvitationService } from '../services/invitation.service';
import { OrganizationService } from '../services/organization.service';
import { errorMessage } from '../utils/form.util';

// Les invitations sont rares : une cloche dans la barre du haut les signale
// sans occuper une entrée du menu.
@Component({
  selector: 'app-invitations-menu',
  imports: [LucideBell],
  templateUrl: './invitations-menu.component.html',
  styleUrl: './invitations-menu.component.css',
})
export class InvitationsMenuComponent {
  private readonly organizations = inject(OrganizationService);
  private readonly invitationService = inject(InvitationService);
  readonly error = signal('');

  readonly invitations = this.invitationService.received();
  readonly count = computed(() =>
    this.invitations.hasValue() ? this.invitations.value().length : 0,
  );
  readonly label = computed(() =>
    this.count() ? `Invitations (${this.count()} en attente)` : 'Invitations',
  );

  accept({ organizationId }: ReceivedInvitation): void {
    this.error.set('');
    this.organizations.acceptInvitation(organizationId).subscribe({
      next: () => this.invitations.reload(),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }

  decline({ organizationId }: ReceivedInvitation): void {
    this.error.set('');
    this.invitationService.decline(organizationId).subscribe({
      next: () => this.invitations.reload(),
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
