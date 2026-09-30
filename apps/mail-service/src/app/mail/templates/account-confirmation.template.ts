import {
  MailTemplate,
  escapeHtml,
  renderButton,
  renderLayout,
} from './mail-template';

/** Confirmation de l'adresse e-mail après la création d'un compte. */
export const accountConfirmationTemplate: MailTemplate = {
  description:
    "Confirmation de l'adresse e-mail après la création d'un compte utilisateur.",
  requiredVariables: ['confirmationUrl'],
  optionalVariables: ['displayName', 'expiresInHours'],
  render(variables) {
    const greeting = variables.displayName
      ? `Bonjour ${variables.displayName},`
      : 'Bonjour,';
    const expiry = variables.expiresInHours
      ? ` Ce lien expire dans ${variables.expiresInHours} heure(s).`
      : '';
    const subject = 'Confirmez votre compte LagonaDeck';

    const text = [
      greeting,
      '',
      'Merci de vous être inscrit sur LagonaDeck. Pour activer votre compte,',
      'confirmez votre adresse e-mail en ouvrant ce lien :',
      variables.confirmationUrl,
      '',
      `Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet e-mail.${expiry}`,
    ].join('\n');

    const html = renderLayout(
      subject,
      `<p>${escapeHtml(greeting)}</p>` +
        `<p>Merci de vous être inscrit sur LagonaDeck. Pour activer votre compte, confirmez votre adresse e-mail :</p>` +
        renderButton(variables.confirmationUrl, 'Confirmer mon adresse') +
        `<p>Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet e-mail.${escapeHtml(expiry)}</p>`,
    );

    return { subject, text, html };
  },
};
