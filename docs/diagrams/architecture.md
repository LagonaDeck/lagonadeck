# Diagrammes d'architecture

Les libellés « prévu » désignent une cible d'architecture sans implémentation ou
configuration correspondante dans le dépôt actuel.

## Architecture globale

```mermaid
flowchart TB
  F[Frontend\nAngular 22 + NgRx] -->|HTTP / REST| G[API Gateway\nNestJS]
  G --> I[Identity Service\nNestJS + Prisma]
  G --> C[Catalog Service\nNestJS + Prisma]
  G --> V[Inventory Service\nNestJS + Prisma]
  G --> S[Sales Service\nNestJS + Prisma]
  G --> A[Analytics Service\nNestJS + Prisma]
  G --> M[Media Service\nNestJS + Prisma]
  I --> IDB[(identity-db)]
  C --> CDB[(catalog-db)]
  V --> VDB[(inventory-db)]
  S --> SDB[(sales-db)]
  A --> ADB[(analytics-db)]
  M --> MDB[(media-db)]
  M --> O[(S3 compatible)]
  I <-. événements prévus .-> R[(RabbitMQ)]
  C <-. événements prévus .-> R
  V <-. événements prévus .-> R
  S <-. événements prévus .-> R
  A <-. événements prévus .-> R
  M <-. événements prévus .-> R
```

## Flux synchrone

```mermaid
flowchart LR
  F[Frontend] -->|REST| G[API Gateway]
  G -->|REST| S[Service concerné]
  S -->|réponse| G
  G -->|réponse| F
```

## Flux événementiel prévu

```mermaid
flowchart LR
  S[Sales Service] -->|sales.sale.completed.v1| R[(RabbitMQ)]
  R --> I[Inventory Service]
  R --> A[Analytics Service]
  I --> IDB[(inventory-db)]
  A --> ADB[(analytics-db)]
```

## Flux média

```mermaid
flowchart TD
  F[Frontend] -->|demande URL| G[API Gateway]
  G --> M[Media Service]
  M --> D[(media-db : métadonnées)]
  M -->|URL pré-signée| G
  G --> F
  F -->|upload direct| O[(S3 compatible : binaires)]
```

## Isolation des bases

```mermaid
flowchart LR
  I[Identity] --> IDB[(identity-db)]
  C[Catalog] --> CDB[(catalog-db)]
  V[Inventory] --> VDB[(inventory-db)]
  S[Sales] --> SDB[(sales-db)]
  A[Analytics] --> ADB[(analytics-db)]
  M[Media] --> MDB[(media-db)]
  V -. accès interdit .-> SDB
  A -. accès interdit .-> VDB
```

## Réplication d'une base de service

L'isolation entre services (ci-dessus) reste inchangée. À l'intérieur de la
frontière d'un service, la base peut être répliquée en plusieurs instances pour la
lecture et la disponibilité — voir
[ADR 0006](../adr/0006-replication-bases-service.md). Topologie primary + réplicas
en lecture : les écritures visent le primary, les lectures se répartissent sur les
réplicas.

```mermaid
flowchart LR
  G[API Gateway] -->|REST + contexte| S[Service métier]
  S -->|écriture| P[(base-service · primary)]
  S -->|lecture| C1[(base-service · réplica 1)]
  S -->|lecture| C2[(base-service · réplica N)]
  P -. réplication .-> C1
  P -. réplication .-> C2
```
