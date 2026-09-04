# Diagrammes d'infrastructure

Deux environnements sont décrits ici.

- L'environnement **dev** est **constaté** : il correspond à
  `infrastructure/docker-compose.dev.yml`.
- L'environnement **prod (Kubernetes)** est **proposé** : aucun manifeste
  Kubernetes n'est présent dans le dépôt à ce jour. Il matérialise l'architecture
  cible, dont la réplication des bases par service
  ([ADR 0006](../adr/0006-replication-bases-service.md)).

## Environnement de développement (Docker Compose)

En dev, une **seule instance PostgreSQL** héberge les six **bases logiques** (une
par service). Il n'y a **pas de réplication** : la réplication primary + réplicas
est une préoccupation de production.

```mermaid
flowchart TB
  DEV[Poste développeur] -->|localhost:4200| FE
  DEV -->|localhost:3000| GW

  subgraph COMPOSE["Docker Compose · projet lagonadeck-dev"]
    subgraph BOOT["Jobs one-shot · restart: no"]
      INSTALL[install-dependencies\nnpm ci]
      PRISMA[prisma-generate\nprisma generate x6]
      MINIT[minio-init\ncrée le bucket]
    end

    FE[frontend\nAngular · 4200]
    GW[api-gateway\nNestJS · 3000]

    subgraph SVC["Services métier NestJS"]
      IDS[identity-service · 3001]
      CAT[catalog-service · 3002]
      INV[inventory-service · 3003]
      SAL[sales-service · 3004]
      ANA[analytics-service · 3005]
      MED[media-service · 3006]
    end

    PG[(postgres:17\n5432)]
    subgraph LOGDB["Bases logiques dans l'unique instance postgres"]
      D1[lagonadeck_identity]
      D2[lagonadeck_catalog]
      D3[lagonadeck_inventory]
      D4[lagonadeck_sales]
      D5[lagonadeck_analytics]
      D6[lagonadeck_media]
    end
    RMQ[(rabbitmq:4\n5672 · 15672)]
    MINIO[(minio\n9000 · 9001\nbucket lagonadeck-media)]
  end

  FE --> GW
  GW --> IDS
  GW --> CAT
  GW --> INV
  GW --> SAL
  GW --> ANA
  GW --> MED

  IDS --> PG
  CAT --> PG
  INV --> PG
  SAL --> PG
  ANA --> PG
  MED --> PG
  PG --- LOGDB

  GW -.événements.-> RMQ
  IDS -.événements.-> RMQ
  CAT -.événements.-> RMQ
  INV -.événements.-> RMQ
  SAL -.événements.-> RMQ
  ANA -.événements.-> RMQ
  MED -.événements.-> RMQ

  MED --> MINIO

  INSTALL -.node_modules.-> SVC
  PRISMA -.client Prisma.-> SVC
```

Volumes Docker persistants : `node_modules`, `postgres_data`, `rabbitmq_data`,
`minio_data`. Les ports listés sont exposés sur l'hôte.

Un service peut aussi être répliqué localement pour tester le scaling :
`docker compose up --scale <service>=N`. Les N réplicas partagent la même image
et deviennent des _competing consumers_ sur RabbitMQ
([ADR 0004](../adr/0004-docker-build-load-balancing.md)).

## Environnement de production (Kubernetes, proposé)

En prod, chaque **base de service** devient un **cluster PostgreSQL** géré par un
operator (1 primary + N réplicas en lecture, réplication streaming — voir
[ADR 0006](../adr/0006-replication-bases-service.md)). Le stockage objet est un
service S3 managé, externe au cluster.

Côté calcul, **chaque micro-service est instancié en N pods et s'autoscale** : un
Deployment répliqué derrière un Service Kubernetes, un HPA qui ajuste le nombre de
pods selon la charge, et — pour les événements — des _competing consumers_ sur la
même queue RabbitMQ (voir [ADR 0004](../adr/0004-docker-build-load-balancing.md)).
Les services sont sans état partagé en mémoire ; le scaling ne demande pas de
coordination applicative.

```mermaid
flowchart TB
  U[Utilisateur] -->|HTTPS| ING[Ingress Controller\nTLS · nginx ou Traefik]

  subgraph K8S["Cluster Kubernetes · namespace lagonadeck"]
    ING --> FE[frontend\nDeployment nginx + statique\nService]
    ING --> GW[api-gateway\nDeployment · N pods + HPA\nService]

    subgraph WL["Services métier · Deployments répliqués + HPA"]
      IDS[identity-service\nN pods]
      CAT[catalog-service\nN pods]
      INV[inventory-service\nN pods]
      SAL[sales-service\nN pods]
      ANA[analytics-service\nN pods]
      MED[media-service\nN pods]
    end
    GW --> IDS
    GW --> CAT
    GW --> INV
    GW --> SAL
    GW --> ANA
    GW --> MED

    RMQ[(RabbitMQ\nStatefulSet en cluster)]
    GW -.événements.-> RMQ
    IDS -.événements.-> RMQ
    CAT -.événements.-> RMQ
    INV -.événements.-> RMQ
    SAL -.événements.-> RMQ
    ANA -.événements.-> RMQ
    MED -.événements.-> RMQ

    subgraph DBS["Bases par service · clusters PostgreSQL via operator"]
      IDB[(identity-db\n1 primary + N réplicas)]
      CDB[(catalog-db\n1 primary + N réplicas)]
      VDB[(inventory-db\n1 primary + N réplicas)]
      SDB[(sales-db\n1 primary + N réplicas)]
      ADB[(analytics-db\n1 primary + N réplicas)]
      MDB[(media-db\n1 primary + N réplicas)]
    end
    IDS --> IDB
    CAT --> CDB
    INV --> VDB
    SAL --> SDB
    ANA --> ADB
    MED --> MDB

    SEC[[Secrets et ConfigMaps]] -.-> GW
    SEC -.-> WL
  end

  MED -->|SDK S3| S3[(Object storage S3 managé\nbucket médias)]
```

### Détail d'un cluster de base (read/write split)

Zoom sur un cluster de base de service : les écritures visent le primary, les
lectures se répartissent sur les réplicas ; la réconciliation couvre le retard de
réplication, la resynchronisation et le basculement
([ADR 0006](../adr/0006-replication-bases-service.md)).

```mermaid
flowchart LR
  S[Service métier\nDeployment + HPA] -->|écriture| P[(primary\nService écriture)]
  S -->|lecture| R1[(réplica 1\nService lecture)]
  S -->|lecture| R2[(réplica N\nService lecture)]
  P -. réplication streaming .-> R1
  P -. réplication streaming .-> R2
```

### Détail scaling d'un service

Chaque micro-service est répliqué en N pods derrière son Service Kubernetes. Le
HPA ajuste le nombre de pods selon la charge ; pour les événements, les pods sont
des _competing consumers_ sur la même queue RabbitMQ, qui répartit les messages
([ADR 0004](../adr/0004-docker-build-load-balancing.md)).

```mermaid
flowchart LR
  GW[api-gateway] -->|REST réparti| SV[Service K8s\nsales-service]
  SV --> P1[pod 1]
  SV --> P2[pod 2]
  SV --> P3[pod N]
  HPA[HPA\nseuils CPU / charge] -. ajuste le nombre de pods .-> SV
  Q[(RabbitMQ\nqueue)] -.competing consumers.-> P1
  Q -.competing consumers.-> P2
  Q -.competing consumers.-> P3
```
