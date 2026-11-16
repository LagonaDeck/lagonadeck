export interface User {
  id: string;
  username: string;
  email: string;
  staffPermissions: string[];
}

export interface InvitableUser {
  id: string;
  username: string;
  email: string;
  invited: boolean;
}
