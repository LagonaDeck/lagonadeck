import { ApiProperty } from '@nestjs/swagger';
import { MAIL_TEMPLATE_NAMES, MailTemplateName } from '../templates';

export class SendMailResponseDto {
  @ApiProperty({
    description: 'Identifiant du message attribué par le serveur SMTP.',
    example: '<9f1e3b2a-4c5d-4e6f-8a7b-0c1d2e3f4a5b@lagonadeck.local>',
  })
  messageId: string;

  @ApiProperty({ enum: MAIL_TEMPLATE_NAMES })
  template: MailTemplateName;

  @ApiProperty({ description: 'Destinataire tel que soumis.' })
  to: string;

  @ApiProperty({ description: 'Sujet effectivement envoyé, après rendu.' })
  subject: string;

  @ApiProperty({
    description: 'Adresses acceptées par le serveur SMTP.',
    type: [String],
  })
  accepted: string[];

  @ApiProperty({
    description: 'Adresses refusées par le serveur SMTP.',
    type: [String],
  })
  rejected: string[];
}
