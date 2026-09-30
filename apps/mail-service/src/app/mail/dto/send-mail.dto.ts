import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { MAIL_TEMPLATE_NAMES, MailTemplateName } from '../templates';

export class SendMailDto {
  @ApiProperty({
    description: 'Adresse e-mail du destinataire.',
    example: 'ada@example.com',
  })
  @IsEmail()
  to: string;

  @ApiProperty({
    description:
      'Gabarit à utiliser. La liste et les variables de chaque gabarit sont exposées par `GET /mail/templates`.',
    enum: MAIL_TEMPLATE_NAMES,
    example: 'account-confirmation',
  })
  @IsString()
  @IsIn(MAIL_TEMPLATE_NAMES)
  template: MailTemplateName;

  @ApiPropertyOptional({
    description:
      'Variables du gabarit, toutes sous forme de chaînes. Les variables requises manquantes, ' +
      'inconnues ou non textuelles sont refusées (400).',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      displayName: 'Ada',
      confirmationUrl: 'https://app.lagonadeck.local/confirm?token=…',
    },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
