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
import { Observable } from 'rxjs';
import {
  LucideCheck,
  LucideChevronDown,
  LucideChevronRight,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { errorMessage, formValues } from '../utils/form.util';
import { Group, PERMISSIONS } from '../models/group';
import { Member } from '../models/member';
import { GroupService } from '../services/group.service';
import { MemberService } from '../services/member.service';

type GroupMember = Pick<Member, 'userId' | 'username'>;

@Component({
  selector: 'app-organization-groups',
  imports: [
    LucideCheck,
    LucideChevronDown,
    LucideChevronRight,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './organization-groups.component.html',
  styleUrl: './organization-groups.component.css',
})
export class OrganizationGroupsComponent {
  private readonly groupService = inject(GroupService);
  readonly organizationId = input.required<string>();
  readonly myPermissions = input.required<string[]>();
  readonly permissions = PERMISSIONS;
  readonly creating = signal(false);
  readonly renaming = signal<string | null>(null);
  readonly open = signal<string | null>(null);
  readonly error = signal('');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  readonly groups = this.groupService.groups(this.organizationId);
  private readonly members = inject(MemberService).members(this.organizationId);
  private readonly memberList = computed(() =>
    this.members.hasValue() ? this.members.value() : [],
  );
  private readonly usernames = computed(
    () =>
      new Map(
        this.memberList().map(({ userId, username }) => [userId, username]),
      ),
  );

  constructor() {
    effect(() => this.field()?.nativeElement.select());
  }

  canCreate(): boolean {
    return this.groupService.canCreate(this.myPermissions());
  }

  canRename(group: Group): boolean {
    return this.groupService.canRename(group, this.myPermissions());
  }

  canDelete(group: Group): boolean {
    return this.groupService.canDelete(group, this.myPermissions());
  }

  memberCount(group: Group): string {
    const count = group.memberIds.length;
    return count === 1 ? '1 membre' : `${count} membres`;
  }

  groupMembers(group: Group): GroupMember[] {
    return group.memberIds.map((userId) => ({
      userId,
      username: this.usernames().get(userId) ?? '…',
    }));
  }

  candidates(group: Group): Member[] {
    return this.memberList().filter(
      ({ userId }) => !group.memberIds.includes(userId),
    );
  }

  canManageMembers(group: Group): boolean {
    return this.groupService.canManageMembers(group, this.myPermissions());
  }

  canToggle(group: Group, permission: string): boolean {
    return this.groupService.canToggle(group, permission, this.myPermissions());
  }

  permissionHint(group: Group, permission: string): string {
    if (group.isOwner || this.canToggle(group, permission)) return '';
    return this.groupService.canEditPermissions(this.myPermissions())
      ? 'Vous ne pouvez accorder que des permissions que vous possédez'
      : 'Il faut la permission « Gérer les permissions des groupes »';
  }

  toggle(group: Group): void {
    this.open.update((open) => (open === group.id ? null : group.id));
  }

  startCreate(): void {
    this.error.set('');
    this.creating.set(true);
  }

  // Échap annule la saisie sans fermer la modale qui contient la page.
  stopCreate(event?: Event): void {
    event?.preventDefault();
    this.creating.set(false);
  }

  stopRename(event?: Event): void {
    event?.preventDefault();
    this.renaming.set(null);
  }

  create(event: SubmitEvent): void {
    const { name } = formValues(event) as { name: string };
    this.run(this.groupService.create(this.organizationId(), name), () =>
      this.creating.set(false),
    );
  }

  rename(event: SubmitEvent, group: Group): void {
    const { name } = formValues(event) as { name: string };
    this.run(
      this.groupService.rename(this.organizationId(), group.id, name),
      () => this.renaming.set(null),
    );
  }

  remove(group: Group): void {
    if (!confirm(`Supprimer le groupe ${group.name} ?`)) return;
    this.run(this.groupService.delete(this.organizationId(), group.id));
  }

  togglePermission(group: Group, permission: string, granted: boolean): void {
    this.run(
      this.groupService.setPermission(
        this.organizationId(),
        group,
        permission,
        granted,
      ),
    );
  }

  addMember(event: SubmitEvent, group: Group): void {
    const { userId } = formValues(event) as { userId: string };
    this.run(
      this.groupService.addMember(this.organizationId(), group.id, userId),
    );
  }

  removeMember(group: Group, member: GroupMember): void {
    this.run(
      this.groupService.removeMember(
        this.organizationId(),
        group.id,
        member.userId,
      ),
    );
  }

  // Chaque action recharge les groupes : l'affichage suit toujours le serveur.
  private run(request: Observable<unknown>, done?: () => void): void {
    this.error.set('');
    request.subscribe({
      next: () => {
        done?.();
        this.groups.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(errorMessage(error));
        this.groups.reload();
      },
    });
  }
}
