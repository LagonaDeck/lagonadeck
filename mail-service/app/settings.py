import os
from dataclasses import dataclass
from functools import cache


@dataclass(frozen=True)
class Settings:
    # Les liens des e-mails sont construits ici, jamais reçus de l'appelant :
    # un e-mail LagonaDeck ne peut pas pointer vers un autre site.
    app_url: str
    mail_from: str
    rabbitmq_url: str
    smtp_host: str
    smtp_port: int
    smtp_starttls: bool
    smtp_username: str | None
    smtp_password: str | None


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is not set")
    return value


@cache
def get_settings() -> Settings:
    return Settings(
        app_url=required("APP_URL").rstrip("/"),
        mail_from=required("MAIL_FROM"),
        rabbitmq_url=required("RABBITMQ_URL"),
        smtp_host=required("SMTP_HOST"),
        smtp_port=int(os.environ.get("SMTP_PORT", "587")),
        smtp_starttls=os.environ.get("SMTP_STARTTLS") == "true",
        smtp_username=os.environ.get("SMTP_USERNAME") or None,
        smtp_password=os.environ.get("SMTP_PASSWORD") or None,
    )
