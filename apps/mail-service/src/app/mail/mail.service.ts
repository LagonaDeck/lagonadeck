import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SmtpService } from '../smtp/smtp.service';
import { SendMailDto } from './dto/send-mail.dto';
import { SendMailResponseDto } from './dto/send-mail-response.dto';
import { MailTemplateDto } from './dto/mail-template.dto';
import {
  MAIL_TEMPLATES,
  MAIL_TEMPLATE_NAMES,
  MailTemplate,
  MailTemplateName,
} from './templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly smtp: SmtpService) {}

  listTemplates(): MailTemplateDto[] {
    return MAIL_TEMPLATE_NAMES.map((name) => {
      const template = MAIL_TEMPLATES[name];
      return {
        name,
        description: template.description,
        requiredVariables: [...template.requiredVariables],
        optionalVariables: [...template.optionalVariables],
      };
    });
  }

  async send(dto: SendMailDto): Promise<SendMailResponseDto> {
    const template = MAIL_TEMPLATES[dto.template];
    const variables = this.resolveVariables(
      dto.template,
      template,
      dto.variables ?? {},
    );
    const rendered = template.render(variables);

    const delivery = await this.smtp.send({ to: dto.to, ...rendered });
    this.logger.log(
      `E-mail « ${dto.template} » envoyé à ${dto.to} (${delivery.messageId})`,
    );

    return {
      messageId: delivery.messageId,
      template: dto.template,
      to: dto.to,
      subject: rendered.subject,
      accepted: delivery.accepted,
      rejected: delivery.rejected,
    };
  }

  /**
   * Refuse tout écart avec le contrat du gabarit avant le rendu : une variable
   * requise absente donnerait un e-mail incomplet, une variable inconnue trahit
   * le plus souvent une faute de frappe côté appelant.
   */
  private resolveVariables(
    name: MailTemplateName,
    template: MailTemplate,
    variables: Record<string, unknown>,
  ): Record<string, string> {
    const nonString = Object.entries(variables)
      .filter(([, value]) => typeof value !== 'string')
      .map(([key]) => key);
    if (nonString.length > 0) {
      throw new BadRequestException(
        `Les variables doivent être des chaînes : ${nonString.join(', ')}`,
      );
    }

    const known = new Set<string>([
      ...template.requiredVariables,
      ...template.optionalVariables,
    ]);
    const unknown = Object.keys(variables).filter((key) => !known.has(key));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Variables inconnues pour le gabarit « ${name} » : ${unknown.join(', ')}`,
      );
    }

    const missing = template.requiredVariables.filter(
      (key) => !(variables[key] as string | undefined)?.trim(),
    );
    if (missing.length > 0) {
      throw new BadRequestException(
        `Variables manquantes pour le gabarit « ${name} » : ${missing.join(', ')}`,
      );
    }

    return variables as Record<string, string>;
  }
}
