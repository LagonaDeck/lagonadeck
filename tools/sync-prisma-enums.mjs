#!/usr/bin/env node
/**
 * Propage les énumérations Prisma partagées vers les schémas des services qui
 * les utilisent.
 *
 * Sous la règle database-per-service, une énumération employée par deux
 * services existe forcément dans les deux bases : PostgreSQL ne partage pas un
 * type `ENUM` entre bases. Ce script fait de cette copie un artefact généré
 * plutôt qu'un doublon maintenu à la main.
 *
 *   node tools/sync-prisma-enums.mjs           écrit les copies
 *   node tools/sync-prisma-enums.mjs --check   échoue si une copie est périmée
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Source de vérité, relative à la racine du dépôt. */
const SOURCE = 'libs/contracts/prisma/shared-enums.prisma';

/** Schémas qui reçoivent une copie des énumérations partagées. */
const TARGETS = [
  'apps/catalog-service/prisma/schema/shared-enums.prisma',
  'apps/inventory-service/prisma/schema/shared-enums.prisma',
];

/** Seul le contenu placé après ce marqueur est propagé. */
const MARKER = '// >>> PROPAGÉ';

const source = readFileSync(join(repoRoot, SOURCE), 'utf8');
const markerAt = source.indexOf(MARKER);
if (markerAt === -1) {
  console.error(`Marqueur "${MARKER}" absent de ${SOURCE}.`);
  process.exit(1);
}

const propagated = source.slice(markerAt + MARKER.length).replace(/^\s+/, '');
const expected =
  `// ⚠️ Fichier généré — ne pas modifier à la main.\n` +
  `// Source : ${SOURCE}\n` +
  `// Régénérer : npm run contracts:sync\n\n` +
  propagated;

const check = process.argv.includes('--check');
const stale = [];

for (const target of TARGETS) {
  let current = null;
  try {
    current = readFileSync(join(repoRoot, target), 'utf8');
  } catch {
    // Copie absente : elle sera écrite, ou signalée périmée en mode --check.
  }

  if (current === expected) {
    continue;
  }
  if (check) {
    stale.push(target);
    continue;
  }
  writeFileSync(join(repoRoot, target), expected);
  console.log(`généré  ${target}`);
}

if (stale.length > 0) {
  const list = stale.map((target) => `  - ${target}`).join('\n');
  console.error(
    `Énumérations partagées désynchronisées :\n${list}\n` +
      'Lancez `npm run contracts:sync` et committez le résultat.',
  );
  process.exit(1);
}

if (check) {
  console.log('Énumérations partagées à jour.');
}
