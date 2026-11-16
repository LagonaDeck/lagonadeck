export interface ReceivedInvitation {
  organizationId: string;
  organizationName: string;
  invitedBy: string;
}

// Un compte invité (`userId`, `username`) ou une adresse sans compte (`email`).
export interface PendingInvitation {
  userId?: string;
  username?: string;
  email?: string;
  createdAt: string;
}
