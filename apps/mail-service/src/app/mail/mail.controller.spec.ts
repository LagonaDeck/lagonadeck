import { Test } from '@nestjs/testing';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

describe('MailController', () => {
  let controller: MailController;
  let service: { listTemplates: jest.Mock; send: jest.Mock };

  beforeEach(async () => {
    service = { listTemplates: jest.fn(), send: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [MailController],
      providers: [{ provide: MailService, useValue: service }],
    }).compile();

    controller = module.get(MailController);
  });

  it('délègue la liste des gabarits au service', () => {
    const templates = [
      {
        name: 'account-confirmation',
        description: 'Confirmation',
        requiredVariables: ['confirmationUrl'],
        optionalVariables: [],
      },
    ];
    service.listTemplates.mockReturnValue(templates);

    expect(controller.listTemplates()).toBe(templates);
  });

  it("délègue l'envoi au service", async () => {
    const dto = {
      to: 'ada@example.com',
      template: 'account-confirmation' as const,
      variables: { confirmationUrl: 'https://x' },
    };
    const response = {
      messageId: '<id>',
      template: 'account-confirmation' as const,
      to: 'ada@example.com',
      subject: 'Confirmez votre compte LagonaDeck',
      accepted: ['ada@example.com'],
      rejected: [],
    };
    service.send.mockResolvedValue(response);

    await expect(controller.send(dto)).resolves.toBe(response);
    expect(service.send).toHaveBeenCalledWith(dto);
  });
});
