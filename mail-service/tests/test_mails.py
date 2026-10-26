import json
import smtplib
from email.message import EmailMessage
from uuid import uuid4

import pytest

from app.consumer import Outcome, SentEvents, process
from app.settings import Settings

SETTINGS = Settings(
    app_url="https://lagonadeck.test",
    mail_from="LagonaDeck <no-reply@lagonadeck.test>",
    rabbitmq_url="amqp://rabbitmq.test",
    smtp_host="smtp.test",
    smtp_port=25,
    smtp_starttls=False,
    smtp_username=None,
    smtp_password=None,
)

CONFIRMATION = {
    "template": "account-confirmation",
    "to": "jane@example.com",
    "username": "JaneDoe",
    "token": "abc-DEF_123",
}

INVITATION = {
    "template": "workspace-invitation",
    "to": "jane@example.com",
    "organizationName": "Boutique de Jane",
    "inviterUsername": "JohnDoe",
    "hasAccount": True,
}


def event(mail: dict, event_id: str | None = None) -> bytes:
    data = {"eventId": event_id or str(uuid4()), "mail": mail}
    return json.dumps({"pattern": "mail.send", "data": data}).encode()


@pytest.fixture
def sent() -> list[EmailMessage]:
    return []


@pytest.fixture
def deliver(sent):
    events = SentEvents()
    return lambda body: process(
        body, SETTINGS, lambda _, message: sent.append(message), events
    )


def html(message: EmailMessage) -> str:
    return message.get_body(("html",)).get_content()


def text(message: EmailMessage) -> str:
    return message.get_body(("plain",)).get_content()


def test_confirmation_links_to_the_app_with_the_token(sent, deliver):
    assert deliver(event(CONFIRMATION)) is Outcome.ACK

    [message] = sent
    assert message["To"] == "jane@example.com"
    assert message["From"] == "LagonaDeck <no-reply@lagonadeck.test>"
    assert message["Subject"] == "Confirmez votre adresse e-mail"
    link = "https://lagonadeck.test/confirm-email?token=abc-DEF_123"
    assert link in text(message)
    assert f'href="{link}"' in html(message)
    assert "JaneDoe" in html(message)


def test_invitation_of_an_account_links_to_its_invitations(sent, deliver):
    deliver(event(INVITATION))

    [message] = sent
    assert message["Subject"] == "JohnDoe vous invite sur Boutique de Jane"
    assert "https://lagonadeck.test/app/invitations" in text(message)


def test_invitation_without_account_links_to_signup_with_the_address(sent, deliver):
    deliver(event({**INVITATION, "hasAccount": False}))

    [message] = sent
    link = "https://lagonadeck.test/signup?email=jane%40example.com"
    assert link in text(message)


def test_user_input_cannot_inject_html(sent, deliver):
    organization = '<a href="https://evil.test">Gagnez</a>'
    deliver(event({**INVITATION, "organizationName": organization}))

    [message] = sent
    assert organization not in html(message)
    assert "&lt;a href=&quot;https://evil.test&quot;&gt;" in html(message)


def test_a_message_delivered_twice_is_sent_once(sent, deliver):
    body = event(CONFIRMATION)

    assert deliver(body) is Outcome.ACK
    assert deliver(body) is Outcome.ACK
    assert len(sent) == 1


@pytest.mark.parametrize(
    "body",
    [
        b"not json",
        json.dumps({"pattern": "other", "data": {}}).encode(),
        json.dumps({"pattern": "mail.send", "data": {"mail": CONFIRMATION}}).encode(),
        event({**CONFIRMATION, "template": "unknown"}),
        event({**CONFIRMATION, "to": "not-an-email"}),
        event({**CONFIRMATION, "token": "../evil"}),
        event({**CONFIRMATION, "link": "https://evil.test"}),
        event({**INVITATION, "organizationName": "Boutique\nBcc: victim@example.com"}),
        event({**INVITATION, "organizationName": ""}),
    ],
)
def test_invalid_message_is_rejected_without_sending(sent, deliver, body):
    assert deliver(body) is Outcome.REJECT
    assert sent == []


@pytest.mark.parametrize(
    ("error", "outcome"),
    [
        (ConnectionRefusedError("SMTP injoignable"), Outcome.RETRY),
        (smtplib.SMTPServerDisconnected("Connexion perdue"), Outcome.RETRY),
        (smtplib.SMTPDataError(451, b"Try again later"), Outcome.RETRY),
        (smtplib.SMTPDataError(554, b"Message rejected"), Outcome.REJECT),
        (
            smtplib.SMTPRecipientsRefused({"jane@example.com": (550, b"Unknown user")}),
            Outcome.REJECT,
        ),
    ],
)
def test_smtp_failure_is_retried_unless_refused_for_good(error, outcome):
    def fail(*_):
        raise error

    assert process(event(CONFIRMATION), SETTINGS, fail, SentEvents()) is outcome


def test_a_retried_message_is_sent_once_the_smtp_is_back(sent):
    events = SentEvents()
    body = event(CONFIRMATION)

    def fail(*_):
        raise ConnectionRefusedError("SMTP injoignable")

    process(body, SETTINGS, fail, events)
    outcome = process(body, SETTINGS, lambda _, message: sent.append(message), events)

    assert outcome is Outcome.ACK
    assert len(sent) == 1
