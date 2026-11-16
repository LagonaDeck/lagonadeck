export interface Organization {
  id: string;
  name: string;
  plan: string;
  groups: string[];
}

const PLAN_LABELS: Record<string, string> = { DISCOVERY: 'Découverte' };

export const planLabel = (plan: string): string => PLAN_LABELS[plan] ?? plan;

export const roleLabel = (organization: Organization): string =>
  organization.groups.join(', ') || 'Aucun groupe';

export function organizationInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.at(-1)?.[0] ?? '')).toUpperCase();
}
