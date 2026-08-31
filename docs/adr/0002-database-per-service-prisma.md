# 0002 — Database-per-service avec Prisma

- **Statut** : Accepté
- **Date** : 2026-08-31
- **Décideurs** : Daniel

## Contexte

Les 6 services métier (`identity`, `catalog`, `inventory`, `sales`, `analytics`,
`media`) persistent des données. En architecture microservices, le partage d'une base
unique entre services crée un couplage fort (schéma commun, migrations
coordonnées, contention) qui annule les bénéfices du découpage en services.

## Décision

Chaque service métier possède **sa propre base de données**, accédée via **son
propre schéma Prisma** (`apps/<service>/prisma/schema.prisma`) et son client Prisma
généré. Aucun service n'accède directement à la base d'un autre : les échanges
passent par les API (`libs/contracts/api`) ou les événements RabbitMQ
(`libs/contracts/events`).

## Raisons

- **Découplage** : chaque service fait évoluer son schéma et ses migrations sans
  coordination avec les autres.
- **Autonomie de déploiement** et d'exploitation (scaling, sauvegardes indépendantes).
- Prisma s'intègre proprement au monorepo : chaque application déclare son propre
  dossier `prisma/` et une sortie de client dédiée, sans collision.

## Conséquences

- ➕ Frontières de données claires, alignées sur les frontières de service.
- ➖ Pas de jointure SQL inter-services : les vues agrégées se construisent via
  composition d'API (au niveau `api-gateway`) ou via des projections alimentées
  par événements (typiquement `analytics-service`).
- ➖ La cohérence inter-services est _éventuelle_ (propagée par événements), pas
  transactionnelle.

## Portée

- **Concernés** : les 6 `*-service` (dont `media-service`, pour ses métadonnées —
  voir [ADR 0005](0005-media-object-storage.md)).
- **Non concerné** : `api-gateway`, qui ne possède pas de données — voir
  [ADR 0003](0003-api-gateway-sans-base.md).
- Le choix du moteur (PostgreSQL par service, instances/schemas séparés) est
  détaillé côté infrastructure (`infrastructure/`).
