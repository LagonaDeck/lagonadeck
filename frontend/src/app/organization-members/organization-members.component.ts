import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Observable } from 'rxjs';
import {
  LucideCrown,
  LucideKeyRound,
  LucideLogOut,
  LucidePlus,
  LucideSearch,
  LucideUserMinus,
  LucideUserPlus,
  LucideX,
} from '@lucide/angular';
import { AuthService } from '../services/auth.service';
import { formatTimestamp } from '../utils/format.util';
import { errorMessage } from '../utils/form.util';
import { InvitationService } from '../services/invitation.service';
import { MemberService } from '../services/member.service';
import { OrganizationService } from '../services/organization.service';
import { Member } from '../models/member';
import { PendingInvitation } from '../models/invitation';
import { InvitableUser } from '../models/user';

const SEARCH_DELAY_MS = 250;

const initials = (username: string) => username.slice(0, 2).toUpperCase();

@Component({
  selector: 'app-organization-members',
  imports: [
    LucideCrown,
    LucideKeyRound,
    LucideLogOut,
    LucidePlus,
    LucideSearch,
    LucideUserMinus,
    LucideUserPlus,
    LucideX,
  ],
  templateUrl: './organization-members.component.html',
  styleUrl: './organization-members.component.css',
})
export class OrganizationMembersComponent {
  private readonly auth = inject(AuthService);
  private readonly organizations = inject(OrganizationService);
  private readonly memberService = inject(MemberService);
  readonly invitationService = inject(InvitationService);
  readonly organizationId = input.required<string>();
  readonly permissions = input.required<string[]>();
  readonly isOwner = input.required<boolean>();
  readonly ownershipTransferred = output();
  readonly initials = initials;
  readonly searching = signal(false);
  readonly query = signal('');
  readonly date = formatTimestamp;
  readonly error = signal('');
  private searchTimer?: ReturnType<typeof setTimeout>;
  private readonly searchField =
    viewChild<ElementRef<HTMLInputElement>>('searchField');

  constructor() {
    effect(() => this.searchField()?.nativeElement.focus());
  }

  readonly canInvite = computed(() =>
    this.invitationService.canInvite(this.permissions()),
  );
  readonly canRemove = computed(() =>
    this.memberService.canRemove(this.permissions()),
  );

  readonly members = this.memberService.members(this.organizationId);
  readonly pending = this.invitationService.pending(() =>
    this.canInvite() ? this.organizationId() : undefined,
  );
  readonly results = this.invitationService.invitableUsers(
    this.organizationId,
    this.query,
  );

  groupNames(member: Member): string {
    return member.groups.map(({ name }) => name).join(', ') || 'Aucun groupe';
  }

  openSearch(): void {
    this.error.set('');
    this.searching.set(true);
  }

  // Échap ferme la recherche sans fermer la modale qui contient la page.
  closeSearch(event?: Event): void {
    event?.preventDefault();
    clearTimeout(this.searchTimer);
    this.query.set('');
    this.searching.set(false);
  }

  // Attend une courte pause dans la saisie avant d'interroger le serveur.
  search(value: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () => this.query.set(value.trim()),
      SEARCH_DELAY_MS,
    );
  }

  invite(user: InvitableUser): void {
    this.run(
      this.invitationService.invite(this.organizationId(), user.id),
      () => {
        this.closeSearch();
        this.pending.reload();
      },
    );
  }

  invitedName(invitation: PendingInvitation): string {
    return invitation.username ?? invitation.email ?? '';
  }

  inviteEmail(email: string): void {
    this.run(
      this.invitationService.inviteByEmail(this.organizationId(), email),
      () => {
        this.closeSearch();
        this.pending.reload();
      },
    );
  }

  revoke(invitation: PendingInvitation): void {
    this.run(
      this.invitationService.revoke(this.organizationId(), invitation),
      () => this.pending.reload(),
    );
  }

  isMe(member: Member): boolean {
    return member.userId === this.auth.user()?.id;
  }

  // TODO: le destinataire acceptera ou refusera par notification ; d'ici là,
  // le transfert s'applique tout de suite.
  transfer(member: Member): void {
    const question = `Transférer la propriété de l’organisation à ${member.username} ? Vous resterez membre, sans permission.`;
    if (!confirm(question)) return;
    this.run(
      this.organizations.transferOwnership(
        this.organizationId(),
        member.userId,
      ),
      () => {
        this.members.reload();
        this.organizations.load().subscribe();
        this.ownershipTransferred.emit();
      },
    );
  }

  remove(member: Member): void {
    if (!confirm(`Retirer ${member.username} de l’organisation ?`)) return;
    this.run(
      this.memberService.remove(this.organizationId(), member.userId),
      () => this.members.reload(),
    );
  }

  // Après le départ, l'organisation disparaît de la liste : la modale passe à
  // l'organisation courante.
  leave(member: Member): void {
    if (!confirm('Quitter cette organisation ?')) return;
    this.run(
      this.memberService.remove(this.organizationId(), member.userId),
      () => this.organizations.load().subscribe(),
    );
  }

  private run(request: Observable<unknown>, done: () => void): void {
    this.error.set('');
    request.subscribe({
      next: done,
      error: (error: HttpErrorResponse) => this.error.set(errorMessage(error)),
    });
  }
}
