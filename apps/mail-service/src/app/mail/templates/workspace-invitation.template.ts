import {
  MailTemplate,
  escapeHtml,
  renderButton,
  renderLayout,
} from './mail-template';

/** Invitation à rejoindre un workspace, envoyée à l'adresse de la personne invitée. */
export const workspaceInvitationTemplate: MailTemplate = {
  description:
    'Invitation à rejoindre un workspace, avec le lien pour accepter.',
  requiredVariables: ['invitationUrl', 'workspaceName', 'inviterName'],
  optionalVariables: ['displayName', 'expiresInHours'],
  render(variables) {
    const greeting = variables.displayName
      ? `Bonjour ${variables.displayName},`
      : 'Bonjour,';
    const expiry = variables.expiresInHours
      ? ` Cette invitation expire dans ${variables.expiresInHours} heure(s).`
      : '';
    const subject = `${variables.inviterName} vous invite à rejoindre « ${variables.workspaceName} » sur LagonaDeck`;
    const intro = `${variables.inviterName} vous invite à rejoindre le workspace « ${variables.workspaceName} » sur LagonaDeck.`;

    const text = [
      greeting,
      '',
      intro,
      'Pour accepter l’invitation, ouvrez ce lien :',
      variables.invitationUrl,
      '',
      `Si vous ne connaissez pas cette personne, ignorez simplement cet e-mail.${expiry}`,
    ].join('\n');

    const html = renderLayout(
      'Invitation à un workspace',
      `<p>${escapeHtml(greeting)}</p>` +
        `<p>${escapeHtml(intro)}</p>` +
        renderButton(variables.invitationUrl, 'Rejoindre le workspace') +
        `<p>Si vous ne connaissez pas cette personne, ignorez simplement cet e-mail.${escapeHtml(expiry)}</p>`,
    );

    return { subject, text, html };
  },
};
