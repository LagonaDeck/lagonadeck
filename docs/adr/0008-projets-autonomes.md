# 0008 — Projets autonomes, sans monorepo

- **Statut** : Accepté
- **Date** : 2026-10-02
- **Décideurs** : Daniel
- **Remplace** : [0001](0001-monorepo-nx.md), [0004](0004-docker-build-load-balancing.md), [0007](0007-identity-password-hashing.md)

## Contexte

Le monorepo Nx, les libs partagées, la stack Docker et les quatre services sans
code (catalog, inventory, sales, analytics) coûtaient plus qu'ils ne
rapportaient : aucun appel inter-service ni événement n'existait encore.

## Décision

- Un projet par dossier à la racine (`frontend`, `api-gateway`,
  `<nom>-service`), chacun avec son `package.json`, son lockfile et son build
  (`nest build`, `ng build`).
- Pas de lib partagée tant que moins de trois services partagent un contrat :
  noms de files et d'événements écrits en dur dans chaque projet.
- Synchrone : `fetch` natif, `AbortSignal.timeout(5000)`, URL en env
  (`SERVICE_X_URL`). Pas d'axios.
- Asynchrone : RabbitMQ via `@nestjs/microservices` (`Transport.RMQ`). Publisher
  avec `ClientsModule.register` + `client.emit(...)` ; consumer en hybrid app
  (`connectMicroservice`, `startAllMicroservices`, `listen`), une file par
  consumer, `durable: true`, `noAck: false`, ack après traitement, `eventId`
  pour ignorer un doublon.
- Mots de passe : `crypto.scrypt` (stdlib) avec un salt aléatoire de 16 octets
  stocké dans `User.salt`, à la place de bcrypt, qui n'a pas de binaire
  précompilé pour Alpine (musl).
- Docker sera réintroduit service par service.

## Conséquences

- Plus de commande globale : chaque projet s'installe, se build et se teste
  dans son dossier ; la CI le fait en matrice.
- catalog, inventory, sales et analytics restent dans l'historique git
  (schémas Prisma compris) et seront recréés quand leur code arrivera.
