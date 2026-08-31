# 0001 — Monorepo géré avec Nx

- **Statut** : Accepté
- **Date** : 2026-08-31
- **Décideurs** : Daniel

## Contexte

flipdeck est une architecture microservices event-driven (RabbitMQ) composée de
plusieurs applications NestJS (`api-gateway` + 6 services métier) et d'un frontend
Angular. Le dépôt contient des bibliothèques partagées :

- `libs/contracts/{events,api}` — contrats des événements RabbitMQ et des API,
  consommés par **plusieurs** services (producteur et consommateur d'un même
  événement doivent partager la même définition) ;
- `libs/shared/{types,validation,utils}`, `libs/observability`, `libs/testing`.

La question : organiser le code en **un monorepo outillé (Nx)** ou en **projets
NestJS autonomes** (un `nest new` par dossier, chacun avec son `package.json`) ?

## Décision

Nous adoptons un **monorepo intégré géré avec Nx**.

## Raisons

- **Partage des bibliothèques.** Les `contracts/` n'ont de valeur que si les services
  les importent directement (`@flipdeck/contracts/events`). Nx fournit ce mapping via
  `tsconfig.base.json`. En projets autonomes, il faudrait publier chaque lib comme
  package npm versionné, ou dupliquer le code — intenable pour des contrats qui
  doivent rester synchronisés.
- **Une seule version des dépendances** (NestJS, Prisma, etc.) pour tout le dépôt,
  au lieu de 6 `package.json` qui dérivent.
- **`nx affected`** : en CI, ne rebuild/re-teste que les projets réellement impactés
  par un changement — précieux avec 7 applications.
- **Config mutualisée** (lint, test, tsconfig) et cache de build/test.

## Conséquences

- ➕ Refactorings transverses (ex. changer un contrat d'événement) atomiques et sûrs.
- ➕ Cohérence de version garantie entre producteur et consommateur d'événements.
- ➖ Le build Docker demande une stratégie adaptée (contexte de build partagé) —
  voir [ADR 0004](0004-docker-build-load-balancing.md).
- ➖ Courbe d'apprentissage Nx pour l'équipe.

## Précisions

- **Monorepo ≠ base de données partagée.** Chaque service garde son propre schéma
  Prisma et sa propre base — voir [ADR 0002](0002-database-per-service-prisma.md).
- **Monorepo ≠ mono-déploiement.** Chaque application se build indépendamment vers
  son propre `dist/` et donne une image Docker autonome.

## Alternative écartée

**Projets NestJS autonomes (`nest new` par dossier).** Plus simple au premier abord,
mais casse le partage des libs, installe `node_modules` 6 fois et provoque de la
dérive de version. Va à l'encontre de la structure du dépôt.
