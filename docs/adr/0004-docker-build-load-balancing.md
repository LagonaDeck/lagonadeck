# 0004 — Stratégie de build Docker et load balancing

- **Statut** : Accepté
- **Date** : 2026-08-31
- **Décideurs** : Daniel

## Contexte

Le code vit dans un monorepo Nx ([ADR 0001](0001-monorepo-nx.md)) : le `package.json`
et le lockfile sont à la racine, partagés. Un `nest new` autonome aurait un
Dockerfile trivial ; en monorepo, il faut définir comment produire une image par
service et comment ces images passent à l'échelle (load balancing).

Point clé à lever : **le monorepo est un choix d'organisation du code, sans impact
sur le runtime.** Le load balancing est une préoccupation d'exécution, découplée de
la structure du dépôt.

## Décision

### Build : une image par application

Chaque application se build indépendamment (`nx build <app>`) vers son propre `dist/`,
puis est empaquetée dans **une image Docker dédiée** (voir `infrastructure/docker/`).
Deux stratégies retenues, à privilégier dans cet ordre :

1. **Build hors Docker puis copie** (défaut) : la CI exécute `nx build <app>`, et le
   Dockerfile se contente de `COPY dist/ + node_modules` dans une image slim.
   → images légères, builds rapides.
2. **Dockerfile multi-stage** avec contexte racine et `.dockerignore` soigné, quand
   le build doit se faire dans l'image elle-même.

Le lockfile racine partagé implique de copier `package.json`/lock racine dans l'étape
d'installation (pas de lock par application) — point d'attention à traiter une fois,
proprement, dans le socle Docker.

### Load balancing : préoccupation runtime

- **HTTP** : un service est répliqué (`docker compose up --scale <service>=N`) derrière
  un reverse proxy (Traefik/nginx) ou via `api-gateway`. Les N replicas exécutent la
  même image.
- **Événementiel (RabbitMQ)** : plusieurs replicas d'un service sont des *competing
  consumers* sur la même queue ; RabbitMQ répartit la charge. Aucune configuration
  liée au monorepo n'intervient.

Les services étant sans état partagé (chacun sa base — [ADR 0002](0002-database-per-service-prisma.md))
et le gateway étant sans état ([ADR 0003](0003-api-gateway-sans-base.md)), le scaling
horizontal ne demande pas de coordination applicative.

## Conséquences

- ➕ Déploiement et scaling indépendants par service.
- ➕ Le choix monorepo n'entrave ni Docker ni le load balancing.
- ➖ Un seul coût à payer une fois : bien poser la stratégie de build Docker
  (contexte partagé, lockfile racine, `.dockerignore`).

## Références

- `infrastructure/docker/` — un dossier par service (Dockerfile + config).
- `infrastructure/docker-compose.yml` — orchestration locale, scaling, reverse proxy.
- `infrastructure/rabbitmq/` — configuration du broker.
