# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projet

LagonaDeck : ERP de flipping de cartes TCG. Pas de monorepo : chaque dossier
racine est un projet indépendant, avec son `package.json`, son lockfile, son
`Dockerfile` et son `compose.yaml`, sans code partagé.

**Stack** : TypeScript 6, Node 26, NestJS 11, Prisma 7 (PostgreSQL 17, driver
adapter `@prisma/adapter-pg`), Angular 22, S3/MinIO, jest + ts-jest, Prettier,
Docker Compose.

**Structure** :

- `frontend/` : Angular CLI, application standalone.
- `api-gateway/` : NestJS, seul point d'entrée HTTP, sans base. Aucune route
  pour l'instant (ni proxy, ni auth).
- `identity-service/` : NestJS + Prisma, utilisateurs (`/api/users`).
- `media-service/` : NestJS + Prisma + S3, upload par POST pré-signé
  (`/api/media`).

**Commandes** :

```bash
make install                         # npm install dans chaque projet
docker compose up --build            # tout le système (le compose racine fait un include: de ceux des projets)
```

Dans le dossier d'un projet :

```bash
npm run start:dev                    # frontend : npm start
npm run build                        # services : prisma generate && nest build → dist/main.js
npm test                             # identity-service, media-service
npx jest src/user.service.spec.ts    # un fichier de test (après un premier npx prisma generate)
npx jest -t "nom du test"            # un test par nom
npm run db:migrate                   # prisma migrate dev
docker compose up                    # ce service seul, avec sa base
```

À la racine : `npx prettier@3 --check .`. Il n'y a ni ESLint ni script de
type-check : le type-check passe par `npm run build`. La CI lance Prettier,
puis `npm ci && npm run build && npm test --if-present` dans chaque projet.

**Patterns** :

- **Organisation de `src/`** : les fichiers sont à plat. `main.ts` déclare
  l'`AppModule` et le bootstrap (prefix `api`, `ValidationPipe` en whitelist +
  forbidNonWhitelisted, Swagger sur `/api/docs`). Un fichier par rôle :
  `*.controller.ts`, `*.service.ts`, et tous les DTO dans `*.dto.ts`. Pas de
  modules Nest intermédiaires.
- **Prisma** :
  - le client est généré dans `src/generated/prisma` (gitignoré) ;
  - il est fourni par une factory `{ provide: PrismaClient }` dans `main.ts`
    et injecté avec `@Inject(PrismaClient)` ;
  - dans les specs, on le mocke avec `useValue`.
- **Erreurs Prisma** : elles sont traduites en HTTP sans pré-contrôle
  (`P2002` → 409, `P2025` → 404).
- **Jest et `module: nodenext`** : le `moduleNameMapper` jest gère les imports
  `.js` du client généré. Dans les specs, utiliser `jest.requireActual` plutôt
  que `import()` dynamique.
- **Variables d'env** :
  - au runtime, `.env` est chargé par `node --env-file-if-exists=.env` ;
  - `prisma.config.ts` utilise `process.loadEnvFile()`.
- **identity** : mots de passe hachés avec `crypto.scrypt` et un salt
  aléatoire stocké dans `User.salt`.
- **media** :
  - le client S3 vit dans `MediaService` ;
  - type et taille sont figés dans la policy du POST pré-signé, puis
    revérifiés par `HeadObject` à `confirm` ;
  - un `setInterval` purge les médias `PENDING` expirés.
- **Communication inter-services** (règles cibles, rien n'est encore câblé) :
  - synchrone : `fetch` avec `signal: AbortSignal.timeout(5000)` et une URL en
    variable d'env `SERVICE_X_URL` ;
  - asynchrone : RabbitMQ via `@nestjs/microservices`, une file durable par
    consumer, `noAck: false`, ack manuel après traitement, `eventId` pour
    ignorer les doublons ;
  - pas de lib partagée en dessous de 3 services qui partagent le même contrat.
- **Docker** :
  - deux stages : `dev` (`npm ci`, build, `start:dev`) et `prod`
    (`npm ci --omit=dev` et `dist`) ; le frontend est servi par nginx en prod ;
  - chaque compose de service déclare son propre Postgres (et MinIO pour
    media).
- **npm 11** : `allowScripts` n'autorise que `prisma` et `@prisma/engines`.

## Commentaires et lisibilité

1. Le code doit être lisible sans commentaire : noms clairs, fonctions simples et courtes.
2. Les commentaires expliquent uniquement le pourquoi, jamais le quoi.
3. Un commentaire long indique généralement que le code doit être simplifié.
4. Décrire uniquement l'état actuel du code. L'historique appartient à Git.
5. Pas de ticket, de code commenté ou de commentaire redondant. Exception : TODO.
6. JSDoc uniquement pour l'API publique, si elle apporte une information utile.
7. Les règles métier doivent être visibles dans les tests.
8. Tout commentaire modifié doit rester exact, sinon le supprimer.

## Développement

1. Toujours réutiliser les patterns existants du projet.
2. Garder le projet homogène.
3. Choisir la solution correcte la plus simple.
4. Éviter la sur-ingénierie et les abstractions prématurées.
5. Ne rien ajouter au cas où.
6. Faire le changement minimal nécessaire.
7. Ne pas refactorer du code hors scope.
8. Ne pas ajouter de dépendance si les outils existants suffisent.
9. Tester les comportements, pas l'implémentation.
10. Une correction de bug doit idéalement avoir un test de régression.
11. Avant de terminer, vérifier les tests, le lint, le type-check et le build disponibles (ici : `npm test`, `npm run build` et Prettier).
12. Si une solution plus simple existe, la préférer.
13. Ne jamais traduire les termes techniques établis. Conserver le vocabulaire de l'écosystème, de la documentation et du projet : `template`, `component`, `hook`, `middleware`, `handler`, `repository`, etc. Par exemple, ne pas remplacer `template` par « gabarit ».
14. Toujours utiliser les commandes make quand elles sont disponibles.
15. Une commande exécutée souvent doit devenir une cible du `Makefile`.

Priorité : correction, cohérence, simplicité, lisibilité, extensibilité.
