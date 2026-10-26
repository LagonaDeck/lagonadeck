import { Injectable, Logger } from '@nestjs/common';
import { ClientRMQ } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';

export type Mail =
  | {
      template: 'account-confirmation';
      to: string;
      username: string;
      token: string;
    }
  | {
      template: 'workspace-invitation';
      to: string;
      organizationName: string;
      inviterUsername: string;
      hasAccount: boolean;
    };

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly client = new ClientRMQ({
    urls: [process.env.RABBITMQ_URL ?? ''],
    queue: 'mail-service',
    queueOptions: { durable: true },
    persistent: true,
  });

  // Sans attendre l'envoi : un broker indisponible n'annule pas l'inscription
  // ni l'invitation, et le lien de confirmation se redemande.
  send(mail: Mail): void {
    this.client.emit('mail.send', { eventId: randomUUID(), mail }).subscribe({
      error: (error) =>
        this.logger.error(`Échec de l'envoi de ${mail.template} : ${error}`),
    });
  }
}
