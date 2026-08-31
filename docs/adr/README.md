# Architecture Decision Records (ADR)

Ce dossier consigne les décisions d'architecture structurantes du projet **lagonadeck**,
avec leur contexte et leurs conséquences. Chaque décision est un fichier numéroté et
ne se réécrit pas : si une décision évolue, on en crée une nouvelle qui remplace
(« Superseded by ») l'ancienne.

Format inspiré de [MADR](https://adr.github.io/madr/).

## Index

| N°   | Titre                                                                              | Statut  | Date       |
| ---- | ---------------------------------------------------------------------------------- | ------- | ---------- |
| 0001 | [Monorepo géré avec Nx](0001-monorepo-nx.md)                                       | Accepté | 2026-08-31 |
| 0002 | [Database-per-service avec Prisma](0002-database-per-service-prisma.md)            | Accepté | 2026-08-31 |
| 0003 | [api-gateway sans base de données](0003-api-gateway-sans-base.md)                  | Accepté | 2026-08-31 |
| 0004 | [Stratégie de build Docker et load balancing](0004-docker-build-load-balancing.md) | Accepté | 2026-08-31 |
| 0005 | [media-service : object storage + Prisma](0005-media-object-storage.md)            | Accepté | 2026-08-31 |

## Statuts possibles

- **Proposé** — en discussion, pas encore tranché.
- **Accepté** — décision en vigueur.
- **Déprécié** — encore présent mais à ne plus suivre pour du nouveau code.
- **Remplacé** — annulé par une ADR ultérieure (référencée).
