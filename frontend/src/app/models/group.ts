export interface Group {
  id: string;
  name: string;
  isOwner: boolean;
  permissions: string[];
  memberIds: string[];
}

export const PERMISSIONS: { id: string; label: string }[] = [
  { id: 'ORGANIZATION_MANAGE', label: 'Gérer l’organisation' },
  { id: 'MEMBER_INVITE', label: 'Inviter des membres' },
  { id: 'MEMBER_REMOVE', label: 'Retirer des membres' },
  { id: 'MEMBER_MANAGE_GROUPS', label: 'Gérer les membres des groupes' },
  { id: 'GROUP_CREATE', label: 'Créer des groupes' },
  { id: 'GROUP_UPDATE', label: 'Renommer les groupes' },
  { id: 'GROUP_DELETE', label: 'Supprimer les groupes' },
  {
    id: 'GROUP_MANAGE_PERMISSIONS',
    label: 'Gérer les permissions des groupes',
  },
  { id: 'BILLING_VIEW', label: 'Voir la facturation' },
  { id: 'BILLING_MANAGE', label: 'Gérer la facturation' },
  { id: 'INVENTORY_MANAGE', label: 'Gérer le stock' },
  { id: 'PURCHASE_MANAGE', label: 'Gérer les achats' },
];
