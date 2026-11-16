export interface Member {
  userId: string;
  username: string;
  isOwner: boolean;
  groups: { id: string; name: string }[];
}
