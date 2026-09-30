/** Résultat du rendu d'un gabarit : les trois parties d'un e-mail. */
export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Un gabarit d'e-mail. Les variables sont des chaînes fournies par le service
 * appelant ; le gabarit déclare celles qu'il exige et celles qu'il tolère, ce
 * qui permet de valider une demande d'envoi avant tout rendu.
 */
export interface MailTemplate {
  /** Description affichée dans Swagger et par `GET /mail/templates`. */
  description: string;
  requiredVariables: readonly string[];
  optionalVariables: readonly string[];
  render(variables: Record<string, string>): RenderedMail;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Toute variable insérée dans le HTML passe ici : les valeurs viennent de l'extérieur. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

/** Bouton d'action suivi du lien en clair, pour les clients qui bloquent les styles. */
export const renderButton = (url: string, label: string): string =>
  `<p style="margin:24px 0;">` +
  `<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">${escapeHtml(label)}</a>` +
  `</p>` +
  `<p style="font-size:12px;color:#6b7280;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${escapeHtml(url)}</p>`;

/** Mise en page commune : le HTML du corps est supposé déjà échappé. */
export const renderLayout = (title: string, bodyHtml: string): string =>
  `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;padding:32px;">
            <tr>
              <td>
                <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(title)}</h1>
                ${bodyHtml}
                <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">LagonaDeck — Buy · Manage · Resell</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
