# Système de design LagonaDeck

Cette charte établit les couleurs de référence de l'interface LagonaDeck. Elle
privilégie une interface ERP sobre : le branding reste expressif, mais les
données, tableaux et graphiques conservent une lecture immédiate.

## Principes

- Réserver le gradient aux éléments de marque, aux CTA ponctuels, aux offres
  premium, aux graphiques et aux highlights.
- Utiliser les surfaces et couleurs neutres pour l'essentiel de l'interface.
- Employer les couleurs métier pour le sens des données, indépendamment des
  couleurs de marque.

## Palette de marque

| Token | Couleur | Hex |
| --- | --- | --- |
| Navy | Bleu nuit | `#11173A` |
| Blue | Bleu électrique | `#1764F9` |
| Sky | Bleu clair | `#0C89F7` |
| Purple | Violet | `#672CF2` |
| Violet | Violet intense | `#8521F1` |
| Teal | Turquoise | `#05CFAC` |

```css
--ld-gradient: linear-gradient(
  135deg,
  #1764f9 0%,
  #672cf2 55%,
  #8521f1 100%
);
```

## Surfaces et bordures

| Usage | Hex |
| --- | --- |
| Background | `#F7F8FC` |
| Surface | `#FFFFFF` |
| Surface secondaire | `#F1F3F9` |
| Surface hover | `#EBEEF6` |
| Border | `#E1E5EF` |
| Border forte | `#CCD2E0` |

## Texte

| Usage | Hex |
| --- | --- |
| Principal | `#11173A` |
| Secondaire | `#52566F` |
| Tertiaire | `#787D94` |
| Désactivé | `#A4A8B7` |
| Sur fond sombre | `#FFFFFF` |

## Actions

| Élément | Normal | Hover / active |
| --- | --- | --- |
| Bouton principal | fond `#1764F9`, texte `#FFFFFF` | `#1255D8` / `#0F46B6` |
| Bouton secondaire | contour et texte `#672CF2` | fond `#F4F0FF` |
| Petit accent | `#05CFAC` | réservé aux états sélectionnés et indicateurs positifs |

## Couleurs métier

| Usage | Hex | Exemples |
| --- | --- | --- |
| Succès / profit | `#05B98F` | rentable, vendu, payé, gain |
| Avertissement | `#F59E0B` | stock dormant, prix à vérifier, lot incomplet |
| Danger / perte | `#E5484D` | erreur, annulation, perte |
| Information | `#0C89F7` | information et aide contextuelle |

## Indicateurs de dashboard

| KPI | Hex |
| --- | --- |
| Capital investi | `#11173A` |
| Valeur marché | `#1764F9` |
| Profit potentiel | `#672CF2` |
| Profit réalisé | `#05B98F` |
| Pertes | `#E5484D` |
| Capital immobilisé | `#F59E0B` |

## Sidebar

- Fond : `#11173A` ; hover : `#1C234D` ; élément actif : `#252D5A`.
- Texte : `#FFFFFF` ; texte secondaire : `#AEB5CC`.
- Accent de l'élément actif : `#1764F9`.
- Préférer un marqueur actif fin à gauche plutôt qu'un aplat saturé.

## Préparation du mode sombre

| Usage | Hex |
| --- | --- |
| Background | `#090D20` |
| Surface | `#11172D` |
| Surface 2 | `#191F38` |
| Border | `#29314F` |
| Texte principal | `#F5F7FF` |
| Texte secondaire | `#AEB5CC` |
| Primary | `#4385FF` |
| Purple | `#8257FF` |
| Accent | `#17D9B7` |

## Variables CSS recommandées

```css
:root {
  /* Brand */
  --ld-navy: #11173a;
  --ld-blue: #1764f9;
  --ld-blue-light: #0c89f7;
  --ld-purple: #672cf2;
  --ld-violet: #8521f1;
  --ld-teal: #05cfac;

  /* Backgrounds */
  --ld-bg: #f7f8fc;
  --ld-surface: #ffffff;
  --ld-surface-secondary: #f1f3f9;
  --ld-surface-hover: #ebeef6;

  /* Borders */
  --ld-border: #e1e5ef;
  --ld-border-strong: #ccd2e0;

  /* Text */
  --ld-text: #11173a;
  --ld-text-secondary: #52566f;
  --ld-text-tertiary: #787d94;
  --ld-text-disabled: #a4a8b7;

  /* Semantic */
  --ld-success: #05b98f;
  --ld-warning: #f59e0b;
  --ld-danger: #e5484d;
  --ld-info: #0c89f7;
}
```
