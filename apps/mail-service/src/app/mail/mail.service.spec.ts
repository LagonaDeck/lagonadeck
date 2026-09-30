import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SmtpService } from '../smtp/smtp.service';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';

describe('MailService', () => {
  let service: MailService;
  let smtp: { send: jest.Mock };

  beforeEach(async () => {
    smtp = { send: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [MailService, { provide: SmtpService, useValue: smtp }],
    }).compile();

    service = module.get(MailService);
  });

  it('liste les gabarits avec leurs variables', () => {
    expect(service.listTemplates()).toEqual([
      {
        name: 'account-confirmation',
        description: expect.any(String),
        requiredVariables: ['confirmationUrl'],
        optionalVariables: ['displayName', 'expiresInHours'],
      },
      {
        name: 'workspace-invitation',
        description: expect.any(String),
        requiredVariables: ['invitationUrl', 'workspaceName', 'inviterName'],
        optionalVariables: ['displayName', 'expiresInHours'],
      },
    ]);
  });

  it("rend le gabarit puis délègue l'envoi au SMTP", async () => {
    smtp.send.mockResolvedValue({
      messageId: '<id@lagonadeck.local>',
      accepted: ['ada@example.com'],
      rejected: [],
    });

    const result = await service.send({
      to: 'ada@example.com',
      template: 'account-confirmation',
      variables: {
        confirmationUrl: 'https://app.lagonadeck.local/confirm?token=abc',
        displayName: 'Ada',
      },
    });

    expect(smtp.send).toHaveBeenCalledWith({
      to: 'ada@example.com',
      subject: 'Confirmez votre compte LagonaDeck',
      text: expect.stringContaining(
        'https://app.lagonadeck.local/confirm?token=abc',
      ),
      html: expect.stringContaining(
        'https://app.lagonadeck.local/confirm?token=abc',
      ),
    });
    expect(result).toEqual({
      messageId: '<id@lagonadeck.local>',
      template: 'account-confirmation',
      to: 'ada@example.com',
      subject: 'Confirmez votre compte LagonaDeck',
      accepted: ['ada@example.com'],
      rejected: [],
    });
  });

  it('refuse une variable requise manquante ou vide', async () => {
    await expect(
      service.send({
        to: 'ada@example.com',
        template: 'workspace-invitation',
        variables: { invitationUrl: 'https://x', workspaceName: '   ' },
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Variables manquantes pour le gabarit « workspace-invitation » : workspaceName, inviterName',
      ),
    );
    expect(smtp.send).not.toHaveBeenCalled();
  });

  it('refuse une variable inconnue', async () => {
    await expect(
      service.send({
        to: 'ada@example.com',
        template: 'account-confirmation',
        variables: { confirmationUrl: 'https://x', confirmUrl: 'https://y' },
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Variables inconnues pour le gabarit « account-confirmation » : confirmUrl',
      ),
    );
    expect(smtp.send).not.toHaveBeenCalled();
  });

  it('refuse une variable qui n’est pas une chaîne', async () => {
    const dto = {
      to: 'ada@example.com',
      template: 'account-confirmation',
      variables: { confirmationUrl: 42 },
    } as unknown as SendMailDto;

    await expect(service.send(dto)).rejects.toThrow(
      new BadRequestException(
        'Les variables doivent être des chaînes : confirmationUrl',
      ),
    );
    expect(smtp.send).not.toHaveBeenCalled();
  });

  it("propage l'erreur du SMTP sans la masquer", async () => {
    smtp.send.mockRejectedValue(new Error('SMTP indisponible'));

    await expect(
      service.send({
        to: 'ada@example.com',
        template: 'account-confirmation',
        variables: { confirmationUrl: 'https://x' },
      }),
    ).rejects.toThrow('SMTP indisponible');
  });
});
