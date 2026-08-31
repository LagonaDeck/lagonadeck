# Microservices

## API Gateway

`api-gateway` est un NestJS sans Prisma ni base de données. Son rôle cible est
le routage des requêtes, l'exposition des API au frontend, l'authentification et
la validation des JWT, la transmission du contexte utilisateur et du workspace
actif, le CORS, les erreurs communes, le logging et les correlation IDs.

Ces responsabilités sont définies par l'architecture et l'ADR 0003 ; elles sont
**à implémenter** dans le code actuel. Le Gateway ne contient pas de logique
métier et ne doit jamais accéder à une base de données d'un service.

## Services métier

| Service   | Responsabilités architecturales                                                                          | État réel                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Identity  | utilisateurs, login, JWT, refresh tokens, workspaces, membres, invitations, rôles et permissions         | modèle Prisma `User` de démarrage ; cas d'usage à implémenter                         |
| Catalog   | jeux TCG, sets, cartes, variantes, raretés, identifiants externes et prix de marché                      | modèle `Product` de démarrage ; intégrations et historique à implémenter              |
| Inventory | achats, lots, frais, allocation de coût, exemplaires physiques, stock, mouvements, réservations et aging | modèle `StockItem` de démarrage ; cycle métier à implémenter                          |
| Sales     | ventes, lignes, acheteurs, marketplaces, frais, retours, bénéfice, marge et ROI                          | modèle `Order` de démarrage ; calculs à implémenter                                   |
| Analytics | dashboard, KPI, CA, bénéfice, ROI, valeur de stock, agrégations et projections                           | modèle d'événement local `Event` ; consommateurs et projections à implémenter         |
| Media     | médias, métadonnées, URLs d'accès, validation, clés S3 et médias par workspace                           | `MediaAsset` et `StorageService` présents ; endpoints et gestion métier à implémenter |

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
