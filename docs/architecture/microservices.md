# Microservices

## API Gateway

`api-gateway` est un NestJS sans Prisma ni base de données. Son rôle cible est
le routage des requêtes, l'exposition des API au frontend, l'authentification et
la validation des JWT, la transmission du contexte utilisateur et du workspace
actif, le CORS, les erreurs communes, le logging et les correlation IDs.

Ces responsabilités sont définies par l'architecture et l'ADR 0003 ; elles sont
**à implémenter** dans le code actuel. Le Gateway ne contient pas de logique
métier et ne doit jamais accéder à une base de données d'un service.

## Mail Service

`mail-service` est un NestJS sans Prisma ni base de données
([ADR 0007](../adr/0007-mail-service-smtp.md)). C'est un service **technique**,
pas un domaine métier : il envoie les e-mails transactionnels pour le compte des
autres services, via le serveur SMTP configuré par l'environnement (Mailpit en
développement).

Son API est volontairement générique : `POST /mail/send` prend un **nom de
gabarit** et des **variables**, `GET /mail/templates` expose les gabarits et les
variables qu'ils attendent. Les gabarits (`account-confirmation`,
`workspace-invitation`) vivent dans le service ; un appelant ne manipule ni HTML
ni SMTP. Toute variable requise manquante, inconnue ou non textuelle est refusée
avant l'envoi.

État réel : service, API et gabarits implémentés ; l'appel depuis
`identity-service` (confirmation de compte, invitations) reste **à implémenter**,
de même que la consommation d'événements RabbitMQ à la place de l'appel REST.

## Services métier

| Service   | Responsabilités architecturales                                                                                        | État réel                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Identity  | utilisateurs, login, JWT, refresh tokens, workspaces, membres, invitations, rôles et permissions                       | modèle Prisma `User` de démarrage ; cas d'usage à implémenter                                                                 |
| Catalog   | jeux TCG, sets, cartes, variantes, raretés, identifiants externes et prix de marché                                    | schéma Prisma et migration initiale présents ; intégrations et imports à implémenter                                          |
| Inventory | fournisseurs, achats, lots, frais, allocation de coût, exemplaires physiques, stock, mouvements, réservations et aging | schéma Prisma et migration initiale présents ; cycle métier à implémenter                                                     |
| Sales     | ventes, lignes, acheteurs, marketplaces, frais, retours, bénéfice, marge et ROI                                        | schéma Prisma et migration initiale présents ; calculs à implémenter                                                          |
| Analytics | dashboard, KPI, CA, bénéfice, ROI, valeur de stock, agrégations et projections                                         | schéma (`Event` et projections) présent ; consommateurs à implémenter                                                         |
| Media     | médias, métadonnées, URLs d'accès, validation, clés S3 et médias par workspace                                         | endpoints CRUD (upload pré-signé, confirmation, téléchargement, suppression) implémentés ; médias par workspace à implémenter |

### Frontières importantes

- Catalog décrit ce qu'est une carte ; Inventory gère les exemplaires réellement
  possédés.
- Inventory porte le cycle `achat → lot → allocation du coût → stock`.
- Sales porte le résultat de la vente ; il ne modifie pas directement
  `inventory-db`.
- Analytics reçoit des événements et persiste ses propres projections ; il ne
  fait pas de jointures vers les bases des services source.
- Media est l'unique façade applicative vers le stockage objet.

Les exemples d'événements suivants sont des conventions **prévues** :
`inventory.purchase.created`, `inventory.lot.received`,
`inventory.item.created`, `inventory.item.updated`, `inventory.item.sold`,
`catalog.price.updated`, `sales.sale.created`, `sales.sale.completed` et
`sales.sale.cancelled`.
