# 0007 — identity-service : bcrypt pour le hachage des mots de passe

- **Statut** : Accepté
- **Date** : 2026-09-23
- **Décideurs** : Équipe identity-service

## Contexte

L'entité `User` d'`identity-service` doit stocker un mot de passe de façon à ce
qu'il ne soit **jamais** récupérable en clair, tout en permettant de vérifier
un mot de passe saisi au login (fonctionnalité de login proprement dite hors
périmètre de cette décision — la persistance Prisma qui s'appuie sur ce choix
est traitée séparément, ticket #38). Il faut choisir un algorithme de hachage
et une stratégie de salage, adaptés à un stack Node.js/NestJS.

## Décision

Le mot de passe est haché avec **bcrypt** (`PasswordService`,
`apps/identity-service/src/app/common/password.service.ts`) :

- `bcrypt.genSalt(saltRounds)` génère un salt aléatoire et unique à chaque
  appel (donc par utilisateur), avec un facteur de coût `saltRounds = 10`
  (valeur par défaut recommandée par la librairie au moment de l'écriture —
  compromis raisonnable entre résistance au brute-force et latence serveur).
- `bcrypt.hash(motDePasse, salt)` produit le hash stocké dans `passwordHash`.
- `bcrypt.compare(motDePasse, hash)` vérifie un mot de passe saisi contre le
  hash stocké, sans jamais avoir besoin de recalculer ou de relire le salt
  séparément.

Le modèle Prisma `User` porte deux champs distincts : `passwordHash` et
`salt`. Le format de hash bcrypt encode déjà le salt utilisé à l'intérieur de
la chaîne `passwordHash` elle-même (préfixe `$2b$<coût>$<salt><hash>`) — la
colonne `salt` séparée n'est donc pas relue par `bcrypt.compare()` et est
redondante pour bcrypt spécifiquement. Elle est conservée telle quelle car :

- c'est un champ explicitement demandé par le ticket (« mot de passe haché +
  salt » comme deux champs distincts de l'entité) ;
- elle documente noir sur blanc, au niveau du schéma, qu'un salage par
  utilisateur a bien lieu — utile pour l'audit/la revue de sécurité sans avoir
  à décoder un hash bcrypt ;
- elle ne coûte rien en sécurité (le salt n'est pas secret) et garde le schéma
  compatible si l'algorithme change un jour vers un schéma qui, lui,
  nécessite un salt stocké séparément.

La validation du mot de passe **avant** hachage (longueur minimale de 8
caractères, présence d'une majuscule, d'une minuscule et d'un chiffre ou
caractère spécial) est portée par `CreateUserDto`
(`@MinLength(8)` + `@Matches(...)`, `class-validator`) : un mot de passe trop
faible est rejeté avant même d'atteindre `PasswordService`.

## Raisons

- **bcrypt vs argon2** : argon2 (en particulier Argon2id) est l'algorithme
  recommandé par l'OWASP pour les nouveaux projets et résiste mieux aux
  attaques matérielles dédiées (GPU/ASIC) grâce à son coût mémoire réglable.
  bcrypt est néanmoins retenu pour cette itération car :
  - il est déjà largement audité, stable depuis des décennies, et le paquet
    `bcrypt` npm (bindings natifs) est mature et très utilisé dans
    l'écosystème Node/NestJS ;
  - il ne nécessite pas de réglage supplémentaire (coût mémoire) au-delà du
    facteur de coût, ce qui limite les erreurs de configuration pour une
    équipe qui découvre le sujet ;
  - le périmètre actuel (MVP, douze semaines, quatre développeurs) privilégie
    une solution simple et bien documentée plutôt que la robustesse maximale.
  - Ce choix peut être révisé : migrer vers argon2 ne casserait pas les
    comptes existants si la vérification reste rétro-compatible (détecter le
    préfixe du hash pour choisir l'algorithme de vérification), à traiter
    dans une ADR ultérieure si le besoin se présente.
- **Salt par utilisateur** : `bcrypt.genSalt()` est appelé à chaque
  inscription, jamais un salt fixe ou partagé — deux utilisateurs avec le même
  mot de passe obtiennent des `passwordHash` différents, ce qui empêche les
  attaques par rainbow table et la corrélation entre comptes.
- **Validation en amont** : rejeter un mot de passe faible avant hachage
  (plutôt qu'après) évite de hacher inutilement une valeur qui sera de toute
  façon refusée, et donne un retour immédiat et explicite au client.

## Conséquences

- ➕ Aucune donnée sensible en clair n'est jamais persistée ; seul
  `passwordHash` (et le `salt` redondant documenté ci-dessus) est stocké.
- ➕ `PasswordService.verify()` est prêt à être branché sur un futur flux de
  login sans modification du schéma.
- ➖ Le facteur de coût (`saltRounds = 10`) est codé en dur dans
  `PasswordService` plutôt que configurable par variable d'environnement ; à
  revoir si le besoin de l'ajuster par environnement (dev vs prod) se
  présente.
- ➖ bcrypt tronque silencieusement les mots de passe au-delà de 72 octets
  (limite intrinsèque à l'algorithme) ; sans incidence avec la contrainte
  actuelle (pas de longueur maximale explicite sur `CreateUserDto.password`),
  mais à garder en tête si une longueur maximale doit être ajoutée plus tard.

## Mise en œuvre

- `PasswordService` (`hash()` / `verify()`), `apps/identity-service/src/app/common/`.
- Modèle Prisma `User` : `passwordHash`, `salt`.
- Validation : `CreateUserDto` (`class-validator`).
- DTOs publics (`UserPublicDto`) : n'exposent jamais `passwordHash` ni `salt`.
