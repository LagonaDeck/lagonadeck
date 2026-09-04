# Architecture LagonaDeck

Cette documentation décrit l'architecture de LagonaDeck et distingue l'état
constaté dans le dépôt de l'architecture visée. Le projet est un ERP de gestion
d'achat, de stock et de revente de cartes TCG, réalisé par une équipe de quatre
développeurs sur douze semaines.

## État du dépôt au 31 août 2026

| Composant                                             | État constaté                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| Monorepo Nx                                           | Présent                                                         |
| Frontend Angular 22 + NgRx                            | Présent, squelette sans fonctionnalité métier                   |
| API Gateway NestJS                                    | Présente, squelette sans routage métier                         |
| Six services NestJS                                   | Présents, squelettes avec Prisma                                |
| Schémas Prisma PostgreSQL                             | Présents ; migrations absentes                                  |
| Media Service / client S3                             | Présent ; URLs pré-signées implémentées                         |
| RabbitMQ                                              | Prévu ; aucune dépendance ni configuration applicative présente |
| Docker Compose / bases locales / object storage local | Prévu ; aucun fichier de composition trouvé                     |

## Parcours

- [Vue d'ensemble](overview.md) — frontières, applications et stack.
- [Microservices](microservices.md) — responsabilités par domaine et état de mise
  en œuvre.
- [Communication](communication.md) — REST synchrone et RabbitMQ asynchrone.
- [Bases de données](databases.md) — règle _database per service_ et Prisma.
- [Médias et stockage](media-storage.md) — séparation métadonnées / objets S3.
- [Diagrammes Mermaid](../diagrams/architecture.md) — vues globales et flux.
- [Diagrammes d'infrastructure](../diagrams/infrastructure.md) — environnements dev
  (constaté) et prod Kubernetes (proposé).
- [ADR](../adr/README.md) — décisions architecturales déjà enregistrées.

Les termes « prévu » et « à implémenter » signalent une direction
architecturale qui n'est pas encore matérialisée dans le code ou
l'infrastructure du dépôt.
