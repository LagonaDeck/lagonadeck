import { MailTemplate } from './mail-template';
import { accountConfirmationTemplate } from './account-confirmation.template';
import { workspaceInvitationTemplate } from './workspace-invitation.template';

/**
 * Registre des gabarits disponibles. Ajouter un cas d'usage = ajouter une
 * entrée ici ; la validation des variables et la documentation Swagger en
 * découlent automatiquement.
 */
export const MAIL_TEMPLATES = {
  'account-confirmation': accountConfirmationTemplate,
  'workspace-invitation': workspaceInvitationTemplate,
} satisfies Record<string, MailTemplate>;

export type MailTemplateName = keyof typeof MAIL_TEMPLATES;

export const MAIL_TEMPLATE_NAMES = Object.keys(
  MAIL_TEMPLATES,
) as MailTemplateName[];

export type { MailTemplate, RenderedMail } from './mail-template';
