export interface User {
  id: string;
  username: string;
  email: string;
  // Remplace `email` une fois le lien de confirmation ouvert.
  pendingEmail: string | null;
  staffPermissions: string[];
}

export interface InvitableUser {
  id: string;
  username: string;
  email: string;
  invited: boolean;
}
