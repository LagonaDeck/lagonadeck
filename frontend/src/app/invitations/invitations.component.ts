import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { errorMessage } from '../utils/form.util';
import { OrganizationService } from '../services/organization.service';
import { InvitationService } from '../services/invitation.service';
import { ReceivedInvitation } from '../models/invitation';

@Component({
  selector: 'app-invitations',
  templateUrl: './invitations.component.html',
  styleUrl: './invitations.component.css',
})
export class InvitationsComponent {
  private readonly organizations = inject(OrganizationService);
  private readonly invitationService = inject(InvitationService);
  readonly error = signal('');

  readonly invitations = this.invitationService.received();

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
