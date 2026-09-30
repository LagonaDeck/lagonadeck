const sendMailMock = jest.fn();
const verifyMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: sendMailMock,
    verify: verifyMock,
  })),
}));

import { createTransport } from 'nodemailer';
import { SmtpService } from './smtp.service';

describe('SmtpService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MAIL_SMTP_HOST = 'mailpit';
    process.env.MAIL_SMTP_PORT = '1025';
    process.env.MAIL_FROM = 'LagonaDeck <no-reply@lagonadeck.local>';
    delete process.env.MAIL_SMTP_SECURE;
    delete process.env.MAIL_SMTP_USER;
    delete process.env.MAIL_SMTP_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("configure le transport depuis l'environnement, sans authentification par défaut", () => {
    new SmtpService();

    expect(createTransport).toHaveBeenCalledWith({
      host: 'mailpit',
      port: 1025,
      secure: false,
      auth: undefined,
    });
  });

  it("active TLS et l'authentification quand un utilisateur est fourni", () => {
    process.env.MAIL_SMTP_SECURE = 'true';
    process.env.MAIL_SMTP_USER = 'smtp-user';
    process.env.MAIL_SMTP_PASSWORD = 'smtp-secret';

    new SmtpService();

    expect(createTransport).toHaveBeenCalledWith({
      host: 'mailpit',
      port: 1025,
      secure: true,
      auth: { user: 'smtp-user', pass: 'smtp-secret' },
    });
  });

  it("retombe sur le port 1025 si la variable de port n'est pas un nombre", () => {
    process.env.MAIL_SMTP_PORT = 'abc';

    new SmtpService();

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 1025 }),
    );
  });

  it("envoie avec l'expéditeur configuré et normalise les adresses acceptées/rejetées", async () => {
    sendMailMock.mockResolvedValue({
      messageId: '<abc@lagonadeck.local>',
      accepted: ['ada@example.com'],
      rejected: [{ address: 'bob@example.com', name: 'Bob' }],
    });
    const service = new SmtpService();

    const result = await service.send({
      to: 'ada@example.com',
      subject: 'Sujet',
      text: 'Texte',
      html: '<p>HTML</p>',
    });

    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'LagonaDeck <no-reply@lagonadeck.local>',
      to: 'ada@example.com',
      subject: 'Sujet',
      text: 'Texte',
      html: '<p>HTML</p>',
    });
    expect(result).toEqual({
      messageId: '<abc@lagonadeck.local>',
      accepted: ['ada@example.com'],
      rejected: ['bob@example.com'],
    });
  });

  it('propage une erreur SMTP à l’appelant', async () => {
    sendMailMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new SmtpService();

    await expect(
      service.send({
        to: 'ada@example.com',
        subject: 's',
        text: 't',
        html: 'h',
      }),
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('journalise sans échouer si le serveur SMTP est injoignable au démarrage', async () => {
    verifyMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(new SmtpService().onModuleInit()).resolves.toBeUndefined();
    expect(verifyMock).toHaveBeenCalledTimes(1);
  });
});
