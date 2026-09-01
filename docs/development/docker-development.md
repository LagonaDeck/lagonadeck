# Environnement Docker de développement

Ce guide décrit l'environnement de développement local de LagonaDeck. Il lance
le monorepo Nx, PostgreSQL, RabbitMQ et MinIO avec Docker Compose. Les sources
sont montées dans les conteneurs ; le frontend et les services NestJS se
recompilent automatiquement après une modification.

## Prérequis

- Docker Engine 26+ ou Docker Desktop récent ;
- Docker Compose v2 (`docker compose version`) ;
- GNU Make pour les raccourcis `make` (les commandes Compose équivalentes sont
  indiquées ci-dessous).

Node.js, npm, PostgreSQL, RabbitMQ et MinIO ne sont pas nécessaires sur la
machine hôte. L'environnement a été validé avec Docker Desktop et Docker
Compose v5.

## Premier démarrage

Depuis la racine du dépôt :

```bash
# Affiche les commandes disponibles
make help

# Construit les images et affiche les logs au premier plan
make docker-up

# Variante en arrière-plan
make docker-up-detached
```

La première exécution télécharge les images et installe les dépendances npm dans
le volume Docker dédié : elle est donc plus lente. Les exécutions suivantes
réutilisent les couches et les volumes existants.

Sans Make, exécutez :

```bash
docker compose -f infrastructure/docker-compose.dev.yml up --build
```

## Services et accès local

| Service     | URL ou port hôte                            | Usage                       |
| ----------- | ------------------------------------------- | --------------------------- |
| Frontend    | <http://localhost:4200>                     | Application Angular         |
| API Gateway | <http://localhost:3000/api>                 | Point d'entrée HTTP         |
| Identity    | <http://localhost:3001/api>                 | Service métier              |
| Catalog     | <http://localhost:3002/api>                 | Service métier              |
| Inventory   | <http://localhost:3003/api>                 | Service métier              |
| Sales       | <http://localhost:3004/api>                 | Service métier              |
| Analytics   | <http://localhost:3005/api>                 | Service métier              |
| Media       | <http://localhost:3006/api>                 | Service métier              |
| PostgreSQL  | `localhost:5432`                            | Base locale (configurable)  |
| RabbitMQ    | `localhost:5672` / <http://localhost:15672> | AMQP / interface de gestion |
| MinIO       | `localhost:9000` / <http://localhost:9001>  | API S3 / console            |

Les applications communiquent entre elles et avec les dépendances via le réseau
Compose et les noms de services (`postgres`, `rabbitmq`, `minio`), jamais via
`localhost` dans les conteneurs. PostgreSQL initialise six bases isolées :
`lagonadeck_identity`, `lagonadeck_catalog`, `lagonadeck_inventory`,
`lagonadeck_sales`, `lagonadeck_analytics` et `lagonadeck_media`.

## Variables de développement

Copiez le fichier d'exemple uniquement si vous devez modifier les valeurs par
défaut :

```bash
cp infrastructure/.env.example infrastructure/.env
```

`infrastructure/.env` est ignoré par Git. Les variables disponibles sont :

| Variable              | Défaut  | Effet                                                                                |
| --------------------- | ------- | ------------------------------------------------------------------------------------ |
| `POSTGRES_PORT`       | `5432`  | Port PostgreSQL exposé sur l'hôte. Utilisez `15432` si le port 5432 est déjà occupé. |
| `CHOKIDAR_USEPOLLING` | `false` | Active le polling pour Angular.                                                      |
| `WATCHPACK_POLLING`   | `false` | Active le polling pour les watchers webpack/Nx.                                      |

Sur Docker Desktop, WSL ou un partage réseau, les notifications du système de
fichiers peuvent ne pas être remontées dans le bind mount. Passez les deux
variables de polling à `true` dans `infrastructure/.env`, puis relancez la
stack. Le polling augmente l'usage CPU.

Les identifiants présents dans le Compose sont réservés au développement local.
Ils ne doivent jamais être réutilisés en recette ou en production ; aucun secret
réel ne doit être ajouté au dépôt.

## Hot reload

- Le frontend Angular est servi avec `nx serve frontend` : les changements
  TypeScript, templates, styles et assets provoquent un rebuild et une mise à
  jour du navigateur.
- Chaque application NestJS lance son daemon Nx dans un répertoire temporaire
  propre au conteneur. Un changement TypeScript déclenche un rebuild puis un
  redémarrage du processus Node.
- Les clients Prisma sont générés séquentiellement par le conteneur ponctuel
  `prisma-generate` au démarrage. Son état `Exited (0)` est normal, tout comme
  celui de `minio-init`, qui crée le bucket une seule fois.

Les fichiers de configuration (`package.json`, `package-lock.json`, Dockerfile,
Compose, `.env`) ne sont pas rechargés à chaud. Après une modification, relancez
la stack avec `make docker-down` puis `make docker-up`.

## Exploitation locale

```bash
# État et healthchecks des conteneurs
docker compose -f infrastructure/docker-compose.dev.yml ps

# Suivre les logs de tous les services
make docker-logs

# Arrêter en préservant données et dépendances npm
make docker-down

# Supprimer conteneurs ET volumes de développement (irréversible)
make docker-reset
```

Les volumes nommés sont `postgres_data`, `rabbitmq_data`, `minio_data` et
`node_modules`. `make docker-reset` les supprime ; la prochaine exécution
recrée les bases, le bucket MinIO et les dépendances.

## Dépannage

| Symptôme                                           | Action                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Le port 5432 est déjà pris                         | Créez `infrastructure/.env` avec `POSTGRES_PORT=15432`, puis relancez.                                                         |
| Un port HTTP est déjà pris                         | Arrêtez le processus concerné ou adaptez le mapping dans le Compose.                                                           |
| Aucun changement n'est détecté                     | Activez les deux variables de polling, puis relancez.                                                                          |
| Prisma ou les dépendances npm semblent incohérents | Lancez `make docker-reset`, puis `make docker-up`.                                                                             |
| Un service ne devient pas `healthy`                | Consultez `make docker-logs` ou les logs ciblés avec `docker compose -f infrastructure/docker-compose.dev.yml logs <service>`. |

## Vérifications effectuées

Sur l'environnement Docker de développement supporté, les vérifications
suivantes ont été réalisées : démarrage complet, healthchecks de tous les
services persistants, génération Prisma, initialisation MinIO, arrêt et
redémarrage, rebuild Angular avec mise à jour client, et modification TypeScript
d'un service NestJS avec recompilation puis redémarrage automatique.
