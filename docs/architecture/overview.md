# Vue d'ensemble

## Objectif et frontières

LagonaDeck est un ERP destiné aux personnes qui achètent et revendent des
cartes TCG. Les domaines couverts sont les utilisateurs et workspaces, le
catalogue, les achats et lots, le stock, les ventes, les prix de marché, les
statistiques et les médias.

L'architecture est un monorepo Nx en TypeScript. Elle sépare une interface
unique des services backend par domaine métier. Le frontend ne doit pas appeler
les services métier directement : l'API Gateway est le point d'entrée HTTP
unique.

## Applications réelles

| Application         | Technologie            | Rôle architectural                                   | État                                     |
| ------------------- | ---------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `frontend`          | Angular 22, NgRx       | Interface utilisateur unique                         | Squelette fonctionnel, store racine vide |
| `api-gateway`       | NestJS                 | Entrée HTTP, routage et préoccupations transversales | Squelette sans logique de gateway        |
| `identity-service`  | NestJS, Prisma         | Identité, accès et workspaces                        | Schéma de démarrage                      |
| `catalog-service`   | NestJS, Prisma         | Référentiel des cartes et prix                       | Schéma de démarrage                      |
| `inventory-service` | NestJS, Prisma         | Achats, lots et stock                                | Schéma de démarrage                      |
| `sales-service`     | NestJS, Prisma         | Ventes et rentabilité                                | Schéma de démarrage                      |
| `analytics-service` | NestJS, Prisma         | Projections et indicateurs                           | Schéma de démarrage                      |
| `media-service`     | NestJS, Prisma, SDK S3 | Métadonnées et accès aux médias                      | Stockage S3 déjà amorcé                  |

Les six services métier et leurs clients Prisma sont indépendants. L'API
Gateway ne possède ni Prisma ni base de données.

## Principes directeurs

- Une frontière de microservice correspond à un domaine métier, pas à une table.
- Chaque service est propriétaire de ses données ; aucune lecture inter-base
  n'est autorisée.
- Les commandes et requêtes avec réponse immédiate utilisent REST via le
  Gateway.
- Les événements métier inter-services utilisent RabbitMQ lorsque celui-ci sera
  configuré ; la cohérence entre services est alors éventuelle.
- Analytics construit ses propres projections et ne lit pas les bases des autres
  services.
- Les binaires sont dans un stockage compatible S3 ; seul Media Service y accède
  avec des identifiants serveur.
- Le monorepo partage l'outillage et des contrats limités, jamais une logique
  métier ou une persistance commune.

## Bibliothèques et infrastructure

Les répertoires `libs/contracts/{api,events}`, `libs/observability`,
`libs/testing` et `libs/shared/{types,utils,validation}` existent, mais ne
contiennent actuellement que des fichiers de maintien. Les contrats d'événements
et DTO transversaux sont donc **prévus**, pas encore implémentés.

`infrastructure/docker/` contient les dossiers des six services et
`infrastructure/rabbitmq/` existe, mais aucun Dockerfile, fichier Compose ni
configuration RabbitMQ n'est versionné à ce stade.
