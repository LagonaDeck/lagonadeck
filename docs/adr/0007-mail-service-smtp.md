# 0007 — mail-service : envoi d'e-mails via SMTP, Mailpit en développement

- **Statut** : Proposé
- **Date** : 2026-09-30
- **Décideurs** : équipe LagonaDeck

## Contexte

Plusieurs cas d'usage à venir demandent d'envoyer un e-mail à un utilisateur :
la **confirmation d'adresse** après la création d'un compte, puis les
**invitations à un workspace** (issue #39). D'autres suivront (réinitialisation
de mot de passe, notifications).

Aujourd'hui, aucun service ne sait envoyer d'e-mail. Deux options se présentent :
placer cette capacité dans `identity-service`, premier consommateur, ou en faire
un service dédié. Il faut aussi pouvoir vérifier les e-mails envoyés **en
développement local** sans compte chez un fournisseur ni risque d'envoyer un
message réel.

## Décision

Un micro-service **`mail-service`**, NestJS, **sans base de données** (comme
`api-gateway`, [ADR 0003](0003-api-gateway-sans-base.md)), porte l'envoi
d'e-mails pour l'ensemble du système.

- Il parle **SMTP** via `nodemailer`. Le serveur cible vient de l'environnement
  (`MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_SMTP_SECURE`, `MAIL_SMTP_USER`,
  `MAIL_SMTP_PASSWORD`, `MAIL_FROM`) : aucun fournisseur n'est câblé dans le code.
- Il est **générique** : l'API prend un **nom de gabarit** et des **variables**
  (`POST /mail/send`), et expose les gabarits disponibles avec leurs variables
  (`GET /mail/templates`). Les gabarits vivent dans le service ; les services
  appelants ne manipulent ni HTML ni SMTP. Deux gabarits sont livrés :
  `account-confirmation` et `workspace-invitation`.
- En **développement**, la stack Docker embarque **Mailpit** comme serveur SMTP
  local avec interface web : tout e-mail envoyé y est capturé et consultable, rien
  ne sort de la machine.
- Les services appellent `mail-service` en **REST synchrone** pour l'instant,
  faute de RabbitMQ configuré. Une consommation d'**événements** (par exemple
  `identity.user.registered.v1`) est la cible quand le broker sera en place ; le
  découpage gabarit/variables est conçu pour que ce passage ne change pas les
  gabarits.

## Raisons

- **Un seul endroit** pour la configuration SMTP, les gabarits, la charte des
  e-mails et, plus tard, les quotas ou la file d'attente — plutôt qu'une copie par
  service consommateur.
- **Découplage** : `identity-service` n'embarque pas de dépendance SMTP ni de
  HTML ; il déclenche un envoi par contrat (nom + variables).
- **Testabilité locale** : Mailpit rend chaque e-mail visible sans compte externe,
  ce qui permet de vérifier confirmation et invitation de bout en bout en dev.
- **Sans base** : un e-mail est une action, pas une donnée à posséder ; ne pas
  créer de base évite une septième base et ses migrations pour rien. Un journal
  d'envoi pourra être ajouté par une ADR ultérieure si le besoin apparaît.

## Conséquences

- ➕ Ajouter un type d'e-mail = ajouter un gabarit dans `mail-service`, sans
  toucher aux services appelants.
- ➕ La stack de dev gagne Mailpit (`localhost:8025`) ; aucun e-mail réel ne peut
  partir d'un poste développeur.
- ➖ Un service de plus à démarrer et à déployer (port `3007`).
- ➖ Appel REST synchrone pour l'instant : un SMTP lent ralentit la requête
  appelante. Le passage à l'événementiel lèvera cette contrainte.
- ➖ Pas d'historique des envois ni de nouvelle tentative automatique : en cas
  d'erreur SMTP, l'appelant reçoit une 500 et décide.

## Portée

- **Concernés** : tous les services qui doivent envoyer un e-mail ; en premier
  `identity-service` (confirmation de compte, invitations de workspace).
- **Non concerné** : les notifications Discord de la CI, qui restent côté GitHub
  Actions.

## Références

- [ADR 0003 — api-gateway sans base de données](0003-api-gateway-sans-base.md)
- [Microservices](../architecture/microservices.md) — section « Mail Service ».
- [Communication](../architecture/communication.md) — REST aujourd'hui, événements
  demain.
- [Environnement Docker de développement](../development/docker-development.md) —
  Mailpit et variables `MAIL_*`.
