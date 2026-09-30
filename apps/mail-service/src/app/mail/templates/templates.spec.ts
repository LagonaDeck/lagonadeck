import { MAIL_TEMPLATES, MAIL_TEMPLATE_NAMES } from './index';
import { escapeHtml } from './mail-template';

describe("gabarits d'e-mail", () => {
  it('expose les deux cas d’usage attendus', () => {
    expect(MAIL_TEMPLATE_NAMES).toEqual([
      'account-confirmation',
      'workspace-invitation',
    ]);
  });

  it.each(MAIL_TEMPLATE_NAMES)(
    '%s se rend avec ses seules variables requises',
    (name) => {
      const template = MAIL_TEMPLATES[name];
      const variables = Object.fromEntries(
        template.requiredVariables.map((key) => [key, `valeur-${key}`]),
      );

      const rendered = template.render(variables);

      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.text.length).toBeGreaterThan(0);
      expect(rendered.html).toContain('<!doctype html>');
      for (const key of template.requiredVariables) {
        expect(rendered.text).toContain(`valeur-${key}`);
        expect(rendered.html).toContain(`valeur-${key}`);
      }
    },
  );

  it('échappe le HTML des variables sans toucher à la version texte', () => {
    const rendered = MAIL_TEMPLATES['account-confirmation'].render({
      confirmationUrl: 'https://app.lagonadeck.local/confirm?token=abc',
      displayName: '<script>alert(1)</script>',
    });

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.text).toContain('Bonjour <script>alert(1)</script>,');
  });

  it("mentionne la durée de validité quand elle est fournie, l'omet sinon", () => {
    const template = MAIL_TEMPLATES['account-confirmation'];
    const base = { confirmationUrl: 'https://app.lagonadeck.local/confirm' };

    expect(template.render(base).text).not.toContain('expire');
    expect(template.render({ ...base, expiresInHours: '24' }).text).toContain(
      'expire dans 24 heure(s)',
    );
  });

  it("l'invitation nomme le workspace et la personne qui invite", () => {
    const rendered = MAIL_TEMPLATES['workspace-invitation'].render({
      invitationUrl: 'https://app.lagonadeck.local/invitations/xyz',
      workspaceName: 'Boutique Ada',
      inviterName: 'Ada',
    });

    expect(rendered.subject).toBe(
      'Ada vous invite à rejoindre « Boutique Ada » sur LagonaDeck',
    );
    expect(rendered.html).toContain(
      'https://app.lagonadeck.local/invitations/xyz',
    );
  });

  it('escapeHtml neutralise les cinq caractères sensibles', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});
