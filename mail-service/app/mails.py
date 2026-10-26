from dataclasses import dataclass
from html import escape
from pathlib import Path
from string import Template
from typing import Annotated, Literal
from urllib.parse import urlencode
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel

TEMPLATES = Path(__file__).parent / "templates"

# Ces textes vont dans le sujet : un retour à la ligne y ajouterait un en-tête.
SingleLine = Annotated[str, Field(min_length=1, pattern=r"^[^\x00-\x1f\x7f]+$")]


@dataclass(frozen=True)
class Content:
    subject: str
    text: str
    html: str


def render(template: str, subject: str, variables: dict[str, str]) -> Content:
    text = Template((TEMPLATES / f"{template}.txt").read_text("utf-8"))
    html = Template((TEMPLATES / f"{template}.html").read_text("utf-8"))
    escaped = {name: escape(value) for name, value in variables.items()}
    return Content(
        subject=subject,
        text=text.substitute(variables),
        html=html.substitute(escaped),
    )


class MailRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid")

    to: EmailStr


class AccountConfirmation(MailRequest):
    template: Literal["account-confirmation"]
    username: Annotated[SingleLine, Field(max_length=30)]
    token: str = Field(pattern=r"^[A-Za-z0-9_-]+$", max_length=128)

    def content(self, app_url: str) -> Content:
        query = urlencode({"token": self.token})
        return render(
            self.template,
            "Confirmez votre adresse e-mail",
            {"username": self.username, "link": f"{app_url}/confirm-email?{query}"},
        )


class WorkspaceInvitation(MailRequest):
    template: Literal["workspace-invitation"]
    organization_name: Annotated[SingleLine, Field(max_length=100)]
    inviter_username: Annotated[SingleLine, Field(max_length=30)]
    # Sans compte, l'invité s'inscrit d'abord avec l'adresse invitée.
    has_account: bool

    def content(self, app_url: str) -> Content:
        link = (
            f"{app_url}/app/invitations"
            if self.has_account
            else f"{app_url}/signup?{urlencode({'email': self.to})}"
        )
        return render(
            self.template,
            f"{self.inviter_username} vous invite sur {self.organization_name}",
            {
                "organization": self.organization_name,
                "inviter": self.inviter_username,
                "link": link,
            },
        )


Mail = Annotated[
    AccountConfirmation | WorkspaceInvitation, Field(discriminator="template")
]


class SendMail(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, extra="forbid")

    event_id: UUID
    mail: Mail


# Enveloppe des événements émis par un ClientRMQ NestJS.
class Event(BaseModel):
    pattern: Literal["mail.send"]
    data: SendMail
