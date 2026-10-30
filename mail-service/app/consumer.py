import asyncio
import logging
from collections.abc import Callable
from email.message import EmailMessage
from enum import Enum
from functools import partial
from uuid import UUID

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustConnection
from pydantic import ValidationError

from app import smtp
from app.mails import Event, Mail
from app.settings import Settings

logger = logging.getLogger(__name__)

QUEUE = "mail-service"
RETRY_DELAY_SECONDS = 5

Sender = Callable[[Settings, EmailMessage], None]


class Outcome(Enum):
    ACK = "ack"
    REJECT = "reject"
    RETRY = "retry"


class SentEvents:
    """Derniers `eventId` envoyés, pour ignorer un message livré deux fois."""

    def __init__(self, limit: int = 10_000) -> None:
        self.limit = limit
        self.ids: dict[UUID, None] = {}

    def __contains__(self, event_id: UUID) -> bool:
        return event_id in self.ids

    def add(self, event_id: UUID) -> None:
        self.ids[event_id] = None
        if len(self.ids) > self.limit:
            del self.ids[next(iter(self.ids))]


def build_message(settings: Settings, mail: Mail) -> EmailMessage:
    content = mail.content(settings.app_url)
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = mail.to
    message["Subject"] = content.subject
    message.set_content(content.text)
    message.add_alternative(content.html, subtype="html")
    return message


def process(body: bytes, settings: Settings, send: Sender, sent: SentEvents) -> Outcome:
    try:
        event = Event.model_validate_json(body).data
    except ValidationError as error:
        # Sans les valeurs reçues : elles contiennent l'adresse et le token.
        errors = error.errors(include_url=False, include_input=False)
        logger.error("Message invalide ignoré : %s", errors)
        return Outcome.REJECT
    if event.event_id in sent:
        return Outcome.ACK
    try:
        send(settings, build_message(settings, event.mail))
    except OSError as error:
        logger.error("Échec de l'envoi de %s : %s", event.mail.template, error)
        return Outcome.REJECT if smtp.is_permanent(error) else Outcome.RETRY
    sent.add(event.event_id)
    return Outcome.ACK


async def handle(
    settings: Settings, sent: SentEvents, message: AbstractIncomingMessage
) -> None:
    outcome = await asyncio.to_thread(process, message.body, settings, smtp.send, sent)
    if outcome is Outcome.ACK:
        await message.ack()
    elif outcome is Outcome.REJECT:
        await message.reject()
    else:
        # Le message bloque la file pendant la pause : un SMTP en panne ne
        # fait pas tourner les messages en boucle.
        await asyncio.sleep(RETRY_DELAY_SECONDS)
        await message.nack(requeue=True)


async def start(settings: Settings) -> AbstractRobustConnection:
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=1)
    queue = await channel.declare_queue(QUEUE, durable=True)
    await queue.consume(partial(handle, settings, SentEvents()))
    return connection
