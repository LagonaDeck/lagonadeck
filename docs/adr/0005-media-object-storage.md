# 0005 — media-service : object storage pour les binaires, Prisma pour les métadonnées

- **Statut** : Accepté
- **Date** : 2026-08-31
- **Décideurs** : Daniel

## Contexte

Un service `media-service` gère les photos. Deux natures de données coexistent :
les **binaires** (les images) et les **métadonnées** (propriétaire, type, taille,
dimensions, statut, variantes). La question : où stocker chacune, et le stack
NestJS + Prisma est-il adapté ?

## Décision

`media-service` est un **NestJS + Prisma** comme les autres services, mais avec une
séparation nette des responsabilités de stockage :

- **Binaires → object storage** : MinIO en local, S3 (ou compatible) en production.
  Le service ne fait pas transiter les octets par lui-même : il délivre des **URLs
  pré-signées** (upload et download) via `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner` (voir `StorageService`).
- **Métadonnées → Prisma + PostgreSQL** : base dédiée au service
  ([ADR 0002](0002-database-per-service-prisma.md)). On n'y stocke que la **clé**
  de l'objet (`storageKey`), jamais le binaire.

## Raisons

- Une base SQL n'est pas faite pour les blobs (coût, performances, sauvegardes
  lourdes, réplication). L'object storage l'est.
- Les URLs pré-signées déchargent l'API du transfert des octets : le client parle
  directement au stockage, le service ne gère que l'autorisation et la métadonnée.
- Garder le même stack (NestJS + Prisma + `contracts/`) préserve la cohérence du
  monorepo ([ADR 0001](0001-monorepo-nx.md)) : outillage, partage de contrats,
  `nx affected`.

## Conséquences

- ➕ Le service reste léger et sans état de fichier ; il scale comme les autres.
- ➕ Le traitement lourd (miniatures, variantes) se fait en asynchrone : après
  l'upload, le service émet un événement (ex. `MediaUploaded`) sur RabbitMQ
  consommé par un worker.
- ➖ Deux systèmes de stockage à provisionner et sauvegarder (Postgres + object
  storage), et une **cohérence à gérer** entre la métadonnée et l'objet (upload
  confirmé avant de passer le statut à `READY`).

## Mise en œuvre

- Modèle Prisma de départ : `MediaAsset` (`storageKey`, `contentType`, `sizeBytes`,
  `width`/`height`, `status`) — à adapter.
- `StorageService` : `presignUpload()` / `presignDownload()`.
- Variables d'environnement (`.env.example`) : `MEDIA_S3_ENDPOINT`,
  `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION`, clés d'accès, `MEDIA_S3_FORCE_PATH_STYLE`.
- Infrastructure : un service MinIO à ajouter au `docker-compose.yml`, dossier
  `infrastructure/docker/media/`.
