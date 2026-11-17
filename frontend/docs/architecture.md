# Architecture du frontend

## Rangement de `src/app/`

```
src/app/
  app.component.ts
  app.component.html
  home/
    home.component.ts
    home.component.html
    home.component.css
  services/
    auth.service.ts
    inventory.service.ts
    inventory.service.spec.ts
  models/
    product.ts
    purchase.ts
  utils/
    format.util.ts
  styles/
    auth.css
```

### Components

- Un dossier par component, nommé comme lui : `home/home.component.ts`,
  `home.component.html`, `home.component.css`.
- La classe porte le suffixe : `HomeComponent`.
- Seul le component racine, `app.component.*`, est directement dans `src/app/`,
  comme le crée Angular CLI.
- Template et styles dans leurs fichiers, pas dans le `.ts`. Pas de `.css` vide :
  supprimer celui créé par `ng generate` s'il reste vide.
- Les styles partagés par plusieurs components vont dans `styles/` et sont
  référencés par `styleUrls`.

### Services

- Tous dans `services/`, nommés `xxx.service.ts`, classe `XxxService`.
- `@Injectable({ providedIn: 'root' })`.
- Les règles métier d'un service sont testées dans `xxx.service.spec.ts`
  (Vitest, `npm test`).

### Models

- Interfaces, types et classes de données dans `models/<objet>.ts`.
- Un fichier par objet, avec ses sous-types, ses libellés et les fonctions qui
  le décrivent : `product.ts` contient `Product`, `PRODUCT_TYPES` et
  `cardName()`.
- Un type propre à un écran (état de formulaire, onglet) reste dans son
  component.

### Utils

- Les fonctions génériques, liées à aucun objet, dans `utils/xxx.util.ts` :
  `format.util.ts` (prix, dates, images) et `form.util.ts` (valeurs et erreurs
  de formulaire).

## Responsabilités

Un **service** :

- fait les appels HTTP, `httpResource` compris ;
- construit les URL (organisation courante, pagination, filtres) ;
- applique les règles métier (permissions, prix, payloads) ;
- garde l'état partagé entre écrans (utilisateur, organisations).

Un **component** ne fait que l'affichage :

- il lit les services et affiche leurs données ;
- il garde son état d'écran : saisie, page, dialog ouvert, délai de recherche,
  `confirm()`.

Pour garder les signals, le service crée le `httpResource` et le component le
lit. La ressource se crée dans un champ du component, qui la détruit avec lui :

```ts
// services/inventory.service.ts
list(page: () => number, search: () => string) {
  return httpResource<InventoryItem[]>(() => /* URL, pagination, recherche */);
}

// inventory/inventory.component.ts
readonly items = this.inventoryService.list(this.page, this.query);
```

En erreur, `value()` lève une exception : une ressource se lit avec
`hasValue()`, par exemple `items.hasValue() ? items.value() : []`.

Les noms de permission restent dans les services :
`OrganizationService.can('INVENTORY_MANAGE')` pour l'organisation courante, ou
une méthode `canXxx(permissions)` quand le component reçoit les permissions
d'une autre organisation.

## Générer

Les schematics d'`angular.json` appliquent ces noms, sans fichier de test : le
spec d'un service s'écrit à la main, pour ses règles métier.

```bash
npx ng generate component home
npx ng generate service services/inventory
```
