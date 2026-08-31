# 0003 — api-gateway sans base de données

- **Statut** : Accepté
- **Date** : 2026-08-31
- **Décideurs** : Daniel

## Contexte

`api-gateway` est une application NestJS. Fallait-il, comme les services métier, lui
associer une base Prisma ?

## Décision

`api-gateway` est un **NestJS sans base de données ni Prisma**. Son rôle se limite au
routage, à l'agrégation/composition de réponses, à l'authentification/autorisation en
entrée et au cross-cutting (rate limiting, CORS, en-têtes de corrélation pour
l'observabilité).

## Raisons

- Un gateway **ne possède pas de données** : il orchestre des appels vers les
  services, qui restent seuls propriétaires de leur persistance
  ([ADR 0002](0002-database-per-service-prisma.md)).
- Lui donner une base réintroduirait un point de couplage et un état partagé que
  l'architecture microservices cherche justement à éviter.
- Un gateway sans état est **trivialement scalable horizontalement** (plusieurs
  replicas identiques derrière un load balancer) — voir
  [ADR 0004](0004-docker-build-load-balancing.md).

## Conséquences

- ➕ Gateway sans état, réplicable sans coordination.
- ➕ Surface d'attaque et responsabilités réduites au strict rôle de passerelle.
- ➖ Toute donnée nécessaire à une réponse doit être obtenue via appel aux services
  (jamais via un accès base direct).

## Note

Un éventuel cache (ex. Redis) au niveau gateway resterait un cache, pas une source de
vérité, et ne remet pas en cause cette décision.
