import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { SendMailResponseDto } from './dto/send-mail-response.dto';
import { MailTemplateDto } from './dto/mail-template.dto';

@ApiTags('mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('templates')
  @ApiOperation({
    summary: 'Liste les gabarits disponibles et leurs variables.',
    description:
      'Permet à un service appelant de découvrir les gabarits et les variables ' +
      "qu'ils attendent avant d'appeler `POST /mail/send`.",
  })
  @ApiResponse({ status: 200, type: [MailTemplateDto] })
  listTemplates(): MailTemplateDto[] {
    return this.mailService.listTemplates();
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Envoie un e-mail à partir d'un gabarit.",
    description:
      "Rend le gabarit demandé avec les variables fournies puis remet l'e-mail au " +
      'serveur SMTP configuré. La réponse est renvoyée une fois le message accepté ' +
      'par le serveur SMTP ; une erreur SMTP se traduit par une 500.',
  })
  @ApiResponse({ status: 200, type: SendMailResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Destinataire invalide, gabarit inconnu, ou variables manquantes / inconnues / non textuelles.',
  })
  send(@Body() dto: SendMailDto): Promise<SendMailResponseDto> {
    return this.mailService.send(dto);
  }
}
