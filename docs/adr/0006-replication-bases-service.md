# 0006 — Réplication des bases par service

- **Statut** : Accepté
- **Date** : 2026-09-04
- **Décideurs** : Daniel

## Contexte

L'[ADR 0002](0002-database-per-service-prisma.md) fixe la règle _database per
service_ : chaque service métier possède sa propre base. Cette décision porte sur
les **frontières** de données, pas sur leur **mise à l'échelle** ni sur leur
**disponibilité**.

Or, une base de service reste par défaut une **instance PostgreSQL unique** : elle
borne le débit de lecture et constitue un point de défaillance unique. Si l'instance
tombe, le service perd l'accès à ses données. L'[ADR 0004](0004-docker-build-load-balancing.md)
traite le scaling horizontal du _calcul_ (N replicas d'un service), mais suppose
implicitement que le tiers de persistance ne se réplique pas.

Il faut donc pouvoir **lancer plusieurs instances d'une même base de service**,
chacune détenant une **copie complète** des données, avec un mécanisme de
**réconciliation** pour les garder cohérentes.

## Décision

La base d'un service peut être déployée en **plusieurs instances répliquées**, chaque
instance détenant une **copie complète** des données du service (réplication, et non
partitionnement). Objectif : passer à l'échelle en **lecture** et améliorer la
**disponibilité**.

Cette ADR **complète** l'ADR 0002 ; elle ne la remplace pas. La règle « une base par
service » reste en vigueur : la réplication se fait **à l'intérieur** de la frontière
d'un service, jamais entre services. Elle **exclut le sharding** (aucune partition
horizontale des données) : toutes les instances d'une base contiennent les mêmes
lignes.

La topologie retenue est **primary + réplicas en lecture** : un **seul nœud accepte
les écritures** (le primary), les **réplicas servent les lectures** et reçoivent une
copie du primary. L'application lit et écrit normalement ; les écritures sont routées
vers le primary, les lectures peuvent se répartir sur les réplicas. Le **multi-maître**
(plusieurs nœuds accepteurs d'écriture) est **écarté** : sa résolution de conflits
d'écriture concurrente n'est pas justifiée par le besoin.

Point laissé ouvert, à trancher lors de la mise en œuvre :

- **Mécanisme de réconciliation** entre instances : rattrapage du retard de
  réplication (_replication lag_), resynchronisation d'un réplica après panne, et
  promotion d'un réplica en primary lors d'un basculement (_failover_).

## Raisons

- **Disponibilité** : la perte d'une instance ne coupe plus l'accès aux données ;
  une autre copie prend le relais.
- **Scalabilité en lecture** : les lectures se répartissent sur plusieurs copies.
- **Frontières préservées** : l'isolation par service (ADR 0002) et l'absence
  d'accès inter-bases restent inchangées.
- **Cohérence avec l'ADR 0004** : le calcul scalait déjà horizontalement ; le tiers
  base gagne la même redondance.

## Conséquences

- ➕ Chaque base de service gagne en disponibilité et en capacité de lecture, par
  ajout d'instances répliquées.
- ➕ Pas de partition : le modèle de requêtes ne change pas (toute instance voit
  toutes les données du service).
- ➖ **Répartition lecture/écriture** : les écritures doivent viser le primary ; les
  lectures peuvent viser un réplica. L'application (ou sa couche d'accès) doit router
  en conséquence.
- ➖ **Écriture non scalée** : un seul primary accepte les écritures ; la réplication
  améliore la lecture et la disponibilité, pas le débit d'écriture.
- ➖ **Retard de réplication** (_replication lag_) : une lecture sur un réplica peut
  renvoyer une donnée légèrement en retard. La cohérence entre copies est
  **éventuelle**.
- ➖ **Réconciliation** : la resynchronisation d'un réplica et le basculement
  (_failover_) doivent être rejouables sans créer de doublons ni perdre d'écritures.
- ➖ **Coût de stockage** : chaque instance stocke une copie complète des données.

## Portée

- **Concernés** : les bases des services demandant de la disponibilité ou de la
  capacité de lecture. Un service peu sollicité peut rester en instance unique ; la
  réplication est une capacité disponible, pas une obligation systématique.
- **Non concerné** : `api-gateway` (sans base — [ADR 0003](0003-api-gateway-sans-base.md)).
- La topologie et le mécanisme de réconciliation sont définis par service au moment
  de l'implémentation (voir les issues liées).

## Références

- [ADR 0002 — Database-per-service avec Prisma](0002-database-per-service-prisma.md)
- [ADR 0004 — Stratégie de build Docker et load balancing](0004-docker-build-load-balancing.md)
- [Données et Prisma](../architecture/databases.md) — section « Scalabilité ».
