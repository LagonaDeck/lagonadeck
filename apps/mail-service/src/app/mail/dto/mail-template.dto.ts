import { ApiProperty } from '@nestjs/swagger';
import { MAIL_TEMPLATE_NAMES, MailTemplateName } from '../templates';

export class MailTemplateDto {
  @ApiProperty({ enum: MAIL_TEMPLATE_NAMES })
  name: MailTemplateName;

  @ApiProperty({ description: 'Cas d’usage couvert par le gabarit.' })
  description: string;

  @ApiProperty({
    description: 'Variables à fournir obligatoirement dans `variables`.',
    type: [String],
  })
  requiredVariables: string[];

  @ApiProperty({
    description: 'Variables acceptées en plus, facultatives.',
    type: [String],
  })
  optionalVariables: string[];
}
