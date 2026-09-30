import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createTransport } from 'nodemailer';

/** Message prêt à partir : le rendu (sujet, texte, HTML) est déjà fait en amont. */
export interface SmtpMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Compte-rendu normalisé d'un envoi SMTP. */
export interface SmtpDeliveryResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

/** Sous-ensemble du compte-rendu renvoyé par nodemailer que l'on exploite. */
interface SentInfo {
  messageId?: string;
  accepted?: unknown[];
  rejected?: unknown[];
}

/** nodemailer mélange chaînes et objets `{ address }` dans accepted/rejected. */
const toAddresses = (entries: unknown[] | undefined): string[] =>
  (entries ?? [])
    .map((entry) =>
      typeof entry === 'string'
        ? entry
        : String((entry as { address?: unknown } | null)?.address ?? ''),
    )
    .filter((address) => address.length > 0);

/**
 * Accès au serveur SMTP (Mailpit en local, fournisseur SMTP en prod) pour l'envoi
 * des e-mails. La configuration vient de l'environnement (variables `MAIL_*`) ;
 * ce service ne connaît ni les gabarits ni les cas d'usage métier.
 */
@Injectable()
export class SmtpService implements OnModuleInit {
  private readonly logger = new Logger(SmtpService.name);
  private readonly transporter: ReturnType<typeof createTransport>;
  private readonly from: string;
  private readonly endpoint: string;

  constructor() {
    const host = process.env.MAIL_SMTP_HOST ?? 'localhost';
    const port = Number.parseInt(process.env.MAIL_SMTP_PORT ?? '', 10) || 1025;
    const secure = process.env.MAIL_SMTP_SECURE === 'true';
    const user = process.env.MAIL_SMTP_USER;

    this.from =
      process.env.MAIL_FROM ?? 'LagonaDeck <no-reply@lagonadeck.local>';
    this.endpoint = `${host}:${port}`;
    this.transporter = createTransport({
      host,
      port,
      secure,
      // Sans utilisateur (cas Mailpit), on se connecte sans authentification.
      auth: user
        ? { user, pass: process.env.MAIL_SMTP_PASSWORD ?? '' }
        : undefined,
    });
  }

  /**
   * Vérifie la connexion SMTP au démarrage. Un échec est journalisé sans
   * bloquer le service : le serveur peut devenir joignable ensuite, et chaque
   * envoi remonte de toute façon sa propre erreur.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log(`Connexion SMTP vérifiée (${this.endpoint})`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Serveur SMTP injoignable au démarrage (${this.endpoint}) : ${reason}`,
      );
    }
  }

  async send(message: SmtpMessage): Promise<SmtpDeliveryResult> {
    const info: SentInfo = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return {
      messageId: info.messageId ?? '',
      accepted: toAddresses(info.accepted),
      rejected: toAddresses(info.rejected),
    };
  }
}
