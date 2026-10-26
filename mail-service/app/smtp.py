import smtplib
from email.message import EmailMessage

from app.settings import Settings

# Un serveur SMTP qui ne répond pas ne doit pas bloquer la file.
TIMEOUT_SECONDS = 10


def send(settings: Settings, message: EmailMessage) -> None:
    with smtplib.SMTP(
        settings.smtp_host, settings.smtp_port, timeout=TIMEOUT_SECONDS
    ) as smtp:
        if settings.smtp_starttls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password or "")
        smtp.send_message(message)


# Un refus 5xx est définitif : renvoyer le même e-mail sera refusé de la même façon.
def is_permanent(error: OSError) -> bool:
    if isinstance(error, smtplib.SMTPRecipientsRefused):
        return all(code >= 500 for code, _ in error.recipients.values())
    return isinstance(error, smtplib.SMTPResponseException) and error.smtp_code >= 500
