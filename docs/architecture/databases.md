# Données et Prisma

## Database per Service

La règle est stricte : chaque microservice métier est seul responsable de sa
base, de son schéma Prisma et de ses migrations. `api-gateway` n'a aucune base.
Un service ne se connecte jamais à la base d'un autre ; les échanges passent par
REST ou, pour la propagation de faits, par RabbitMQ.

| Service             | Base logique visée | Schéma présent | Modèle de démarrage |
| ------------------- | ------------------ | -------------- | ------------------- |
| `identity-service`  | `identity-db`      | Oui            | `User`              |
| `catalog-service`   | `catalog-db`       | Oui            | `Product`           |
| `inventory-service` | `inventory-db`     | Oui            | `StockItem`         |
| `sales-service`     | `sales-db`         | Oui            | `Order`             |
| `analytics-service` | `analytics-db`     | Oui            | `Event`             |
| `media-service`     | `media-db`         | Oui            | `MediaAsset`        |

Les noms de base sont des noms logiques documentés : le dépôt configure chaque
connexion via `DATABASE_URL` dans son `prisma.config.ts`, mais ne versionne pas
de fichiers d'environnement ni d'infrastructure PostgreSQL locale. Aucun dossier
`prisma/migrations/` n'est présent à ce jour.

## Mise en œuvre actuelle

Chaque service ci-dessus contient :

```text
apps/<service>/
├── prisma.config.ts
├── prisma/schema.prisma
└── src/generated/prisma/       # généré, non versionné
```

Prisma 7 utilise le provider PostgreSQL et le driver adapter `@prisma/adapter-pg`.
Les modèles existants sont des modèles de départ, pas encore le modèle complet
du domaine métier.

## Scalabilité : réplication des bases par service

La règle _database per service_ porte sur les **frontières** de données, pas sur
leur mise à l'échelle ni leur disponibilité : une base de service reste par défaut
une instance PostgreSQL unique, qui borne le débit de lecture et constitue un point
de défaillance unique.

Pour y remédier, la base d'un service peut être déployée en **plusieurs instances
répliquées** (topologie **primary + réplicas en lecture**), chacune détenant une
**copie complète** des données — réplication, **pas** sharding, et toujours à
l'intérieur de la frontière d'un service. L'objectif est de passer à l'échelle en
**lecture** et d'améliorer la **disponibilité** ; la réplication est une capacité
disponible, pas une obligation systématique.

```mermaid
flowchart LR
  S[Service métier] -->|écriture| P[(base-service · primary)]
  S -->|lecture| C1[(base-service · réplica 1)]
  S -->|lecture| C2[(base-service · réplica N)]
  P -. réplication .-> C1
  P -. réplication .-> C2
```

Le détail de la décision — répartition lecture/écriture, réconciliation entre
instances (retard de réplication, resynchronisation, basculement) et cohérence
éventuelle — est traité dans l'[ADR 0006](../adr/0006-replication-bases-service.md).

## Interdictions

```mermaid
flowchart LR
  I[Inventory Service] -. accès interdit .-> SDB[(sales-db)]
  I -->|API ou événement| S[Sales Service]
  S --> SDB
```

Il n'existe pas de schéma Prisma central et il ne doit pas en être créé. Les
entités métier, repositories et migrations restent dans le service propriétaire.
