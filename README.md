<p align="center">
  <img src="docs/assets/logo.png" alt="FlipDeck — Buy · Manage · Resell" width="380" />
</p>

# FlipDeck

**FlipDeck** est une application ERP destinée aux particuliers et professionnels qui achètent et revendent des cartes à collectionner **TCG (Trading Card Games)** dans une logique de *flipping*.

L'objectif de FlipDeck est de centraliser l'ensemble du cycle de vie d'une carte, depuis son acquisition jusqu'à sa revente, tout en permettant de suivre précisément le stock, les coûts, les prix du marché et la rentabilité.

L'application permet notamment de gérer les achats de cartes par lots, de répartir dynamiquement le coût d'un lot entre les différentes cartes, de suivre l'évolution du stock, d'enregistrer les ventes et de calculer automatiquement les marges, bénéfices et retours sur investissement.

FlipDeck intègre également un système de **workspaces multi-utilisateurs**, permettant à plusieurs personnes de gérer un même inventaire tout en conservant une séparation claire entre différents espaces de travail.

Les données du marché peuvent être utilisées afin de comparer le coût d'acquisition d'une carte à sa valeur actuelle et ainsi faciliter les décisions de vente.

## Fonctionnalités principales

* Gestion des utilisateurs et des workspaces
* Gestion d'un catalogue de cartes TCG
* Gestion des achats et des lots
* Allocation dynamique du coût d'acquisition d'un lot
* Gestion et suivi du stock
* Suivi des prix du marché
* Gestion des ventes et des frais associés
* Calcul des bénéfices, marges et ROI
* Historique et analyse des performances
* Tableau de bord avec indicateurs financiers et statistiques
* Gestion des médias (photos des cartes)

## Architecture

FlipDeck repose sur une architecture **microservices** avec une base de données indépendante pour chaque domaine métier.

L'application est composée d'un frontend unique développé avec **Angular** (gestion d'état **NgRx**), communiquant avec les services backend à travers une **API Gateway NestJS**.

Les différents microservices sont développés avec **NestJS** et communiquent de manière synchrone via leurs APIs ou de manière asynchrone à travers **RabbitMQ**.

```text
Angular Frontend (NgRx)
       │
       ▼
   API Gateway (NestJS)
       │
       ├── Identity Service    → PostgreSQL
       ├── Catalog Service     → PostgreSQL
       ├── Inventory Service   → PostgreSQL
       ├── Sales Service       → PostgreSQL
       ├── Analytics Service   → PostgreSQL
       └── Media Service       → PostgreSQL + Object Storage (S3/MinIO)
                │
                ▼
             RabbitMQ
```

Chaque microservice possède sa propre base **PostgreSQL**, garantissant l'isolation des données et des responsabilités. Le **Media Service** stocke en plus les binaires (photos) sur un **object storage** (MinIO en local, S3 en production) et ne conserve en base que les métadonnées.

Les décisions d'architecture sont documentées sous forme d'ADR dans [`docs/adr/`](docs/adr/).

## Structure du monorepo

Le dépôt est un **monorepo [Nx](https://nx.dev)**.

```text
apps/
  frontend/            Angular + NgRx
  api-gateway/         NestJS (passerelle, sans base)
  identity-service/    NestJS + Prisma
  catalog-service/     NestJS + Prisma
  inventory-service/   NestJS + Prisma
  sales-service/       NestJS + Prisma
  analytics-service/   NestJS + Prisma
  media-service/       NestJS + Prisma + object storage
libs/
  contracts/           contrats d'API et d'événements partagés
  shared/              types, validation, utils
  observability/
  testing/
infrastructure/        Docker, RabbitMQ, docker-compose
docs/                  architecture, diagrammes, API, ADR
```

## Stack technique

* **Frontend** : Angular, NgRx
* **Backend** : NestJS (API Gateway + microservices)
* **ORM** : Prisma 7 (database-per-service, driver adapter PostgreSQL)
* **Base de données** : PostgreSQL (une par service)
* **Messagerie** : RabbitMQ (communication asynchrone)
* **Stockage média** : object storage compatible S3 (MinIO en local)
* **Monorepo & outillage** : Nx, TypeScript, ESLint, Prettier
* **Conteneurisation** : Docker / Docker Compose

## Démarrage

```bash
# Installer les dépendances
npm install

# Configurer l'environnement d'un service (à répéter par service)
cp apps/identity-service/.env.example apps/identity-service/.env

# Générer le client Prisma d'un service
npm run db:generate -w @flipdeck/identity-service

# Lancer un service en développement
npx nx serve identity-service

# Construire toutes les applications
npx nx run-many -t build
```

> Le client Prisma généré (`apps/*/src/generated/`) et les fichiers `.env` ne sont pas versionnés : régénérer le client via `npm run db:generate -w <service>` après un clone.

## Objectif du projet

FlipDeck est réalisé dans le cadre d'un **projet académique en informatique** par une équipe de quatre développeurs.

Le projet a pour objectif de mettre en pratique plusieurs concepts de développement logiciel modernes :

* Architecture microservices
* Architecture orientée événements
* API Gateway
* Communication asynchrone
* Database per Service
* Applications frontend/backend TypeScript
* Gestion d'état avec NgRx
* APIs REST
* Conteneurisation avec Docker
* Travail collaboratif avec Git et GitHub
* Intégration et tests automatisés

L'objectif n'est donc pas uniquement de développer un gestionnaire de cartes TCG, mais de construire une application complète permettant d'expérimenter une **architecture distribuée réaliste** sur un domaine métier concret.

## Licence

Distribué sous licence [MIT](LICENSE).
