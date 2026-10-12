export interface TcgdexCard {
  /** `<langue>/<set>-<numéro>` : TCGdex réutilise des identifiants de set d'une langue à l'autre. */
  tcgdexId: string;
  name: string;
  englishName: string | null;
  setCode: string;
  setName: string | null;
  cardNumber: string;
  rarity: string | null;
  imageUrl: string;
  /** `null` quand la carte ne liste pas ses variantes. */
  hasReverse: boolean | null;
  /** Talents et attaques, en anglais : Cardmarket les met dans ses noms. */
  moves: string[];
  /**
   * Identifiants Cardmarket annoncés par TCGdex, à vérifier avant de lier,
   * la version de base d'abord (voir `cardmarketIdsByVariant`).
   */
  cardmarketIds: number[];
}

const TCGDEX_ASSETS = 'https://assets.tcgdex.net';
// `data/` : cartes internationales ; `data-asia/` : cartes japonaises.
const TCGDEX_LANGUAGES: Record<string, string> = {
  data: 'en',
  'data-asia': 'ja',
};
// Pokémon TCG Pocket est un jeu mobile : ses cartes ne se vendent pas.
const EXCLUDED_SERIES = new Set(['tcgp']);

/** Fichiers texte d'une archive tar (format ustar, chemins longs en pax). */
export function readTarFiles(
  tar: Buffer,
  keep: (path: string) => boolean,
): Map<string, string> {
  const files = new Map<string, string>();
  let offset = 0;
  let paxPath: string | undefined;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start: number, length: number) =>
      header
        .subarray(start, start + length)
        .toString('utf8')
        .replace(/\0.*$/s, '');
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const type = field(156, 1);
    const body = tar.subarray(offset + 512, offset + 512 + size);
    const prefix = field(345, 155);
    const path =
      paxPath ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    paxPath = undefined;
    if (type === 'x') {
      paxPath = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString('utf8'))?.[1];
    } else if ((type === '0' || type === '') && keep(path)) {
      files.set(path, body.toString('utf8'));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

/**
 * Cartes Pokémon de TCGdex, depuis l'archive de `cards-database` :
 * `<data>/<série>.ts`, `<data>/<série>/<set>.ts` et
 * `<data>/<série>/<set>/<numéro>.ts`.
 */
export function tcgdexCards(archive: Map<string, string>): TcgdexCard[] {
  // Retire le dossier racine de l'archive (`cards-database-master/`).
  const files = new Map(
    [...archive].map(([path, source]) => [
      path.split('/').slice(1).join('/'),
      source,
    ]),
  );
  const cards: TcgdexCard[] = [];
  for (const [path, source] of files) {
    const [root, serie, set, card] = path.split('/');
    const language = TCGDEX_LANGUAGES[root];
    if (!language || !card?.endsWith('.ts')) continue;
    const serieId = topLevelId(files.get(`${root}/${serie}.ts`) ?? '');
    const setSource = files.get(`${root}/${serie}/${set}.ts`) ?? '';
    const setId = topLevelId(setSource);
    if (!serieId || !setId || EXCLUDED_SERIES.has(serieId)) continue;
    const cardNumber = card.slice(0, -3);
    const names = topLevel(source, NAME_BLOCKS) ?? '';
    const rarity = /^\s*rarity:\s*["']([^"']+)["']/m.exec(source)?.[1];
    cards.push({
      tcgdexId: `${language}/${setId}-${cardNumber}`,
      name:
        translation(names, 'fr') ??
        translation(names, 'en') ??
        translation(names, 'ja') ??
        cardNumber,
      englishName: translation(names, 'en'),
      // Sans code officiel (promos surtout), l'identifiant TCGdex du set.
      setCode: officialAbbreviation(setSource) ?? setId,
      setName:
        localizedName(setSource, 'fr') ??
        localizedName(setSource, 'en') ??
        localizedName(setSource, 'ja'),
      cardNumber,
      rarity: rarity && rarity !== 'None' ? rarity : null,
      imageUrl: `${TCGDEX_ASSETS}/${language}/${serieId}/${setId}/${cardNumber}/high.webp`,
      hasReverse: hasReverse(source),
      moves: moveNames(source),
      cardmarketIds: cardmarketIdsByVariant(source),
    });
  }
  return cards;
}

// Deux formats : `variants: [{ type: 'reverse', … }]` ou, plus ancien,
// `variants: { normal: true, reverse: true, … }`. Une reverse spéciale (`foil` :
// Poké Ball, Team Rocket…) a son propre produit Cardmarket : elle ne compte pas.
function hasReverse(source: string): boolean | null {
  if (!/^\s*variants:/m.test(source)) return null;
  if (/^\s*reverse:\s*true/m.test(source)) return true;
  return source.split(/\btype:\s*/).some((part) => {
    const variant = part.split('}')[0];
    return /^["']reverse["']/.test(variant) && !/\bfoil:/.test(variant);
  });
}

// Cardmarket vend parfois chaque variante comme un produit à part : la
// version de base porte le prix de la carte.
const VARIANT_RANKS: Record<string, number> = {
  normal: 1,
  holo: 2,
  reverse: 3,
};
const VARIANT_IDS =
  /\{\s*type:\s*["'](\w+)["']([^{}]*?)thirdParty:\s*\{[^}]*?cardmarket:\s*(\d+)/g;

/**
 * Identifiants de la carte elle-même d'abord, puis des variantes normale,
 * holo et reverse, puis des versions spéciales (`foil` : League, Cosmos…).
 */
function cardmarketIdsByVariant(source: string): number[] {
  const ranks = new Map<number, number>();
  for (const [, type, details, id] of source.matchAll(VARIANT_IDS)) {
    const rank =
      (VARIANT_RANKS[type] ?? 4) + (/\bfoil:/.test(details) ? 10 : 0);
    ranks.set(Number(id), Math.min(rank, ranks.get(Number(id)) ?? rank));
  }
  for (const [, id] of source.matchAll(/cardmarket:\s*(\d+)/g)) {
    if (!ranks.has(Number(id))) ranks.set(Number(id), 0);
  }
  return [...ranks].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

export interface LinkableCard {
  id: string;
  moves: string[];
  tcgdexCardmarketIds: number[];
}

/**
 * Liens sûrs carte → produit Cardmarket : TCGdex donne parfois le même
 * identifiant à plusieurs cartes (Mewtwo EX BKT 61, 62, 157, 158, 163, 164).
 * Chaque carte retient sa première variante dont le produit Cardmarket a ses
 * talents et attaques, et qui n'est pas déjà liée à la main (`reserved`) ; un
 * produit retenu par deux cartes ne lie aucune des deux.
 */
export function cardmarketLinks(
  cards: LinkableCard[],
  cardmarketNames: Map<number, string>,
  reserved: Set<number>,
): Map<string, number> {
  const claims = new Map<number, string[]>();
  for (const card of cards) {
    const valid = card.tcgdexCardmarketIds.filter((id) => {
      const name = cardmarketNames.get(id);
      return (
        name !== undefined && !reserved.has(id) && sameMoves(name, card.moves)
      );
    });
    if (valid.length === 0) continue;
    claims.set(valid[0], [...(claims.get(valid[0]) ?? []), card.id]);
  }
  const links = new Map<string, number>();
  for (const [cardmarketId, cardIds] of claims) {
    if (cardIds.length === 1) links.set(cardIds[0], cardmarketId);
  }
  return links;
}

// Sans espaces ni ponctuation : « Long-Distance » et « Long Distance ».
const normalizeMove = (move: string) =>
  move.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Sans liste entre crochets (Dresseur, Énergie), rien à comparer. Cardmarket
// ajoute parfois le nom du set : « Weedle [Poison Sting | Base Set] ».
function sameMoves(cardmarketName: string, moves: string[]): boolean {
  const listed = /\[([^\]]*)\]$/.exec(cardmarketName)?.[1];
  if (!listed || moves.length === 0) return true;
  const expected = new Set(listed.split('|').map(normalizeMove));
  return moves.every((move) => expected.has(normalizeMove(move)));
}

// Le champ le moins indenté : `id` et `name` existent aussi plus bas (nom
// indonésien d'une série, noms des attaques).
function topLevel(source: string, pattern: RegExp): string | undefined {
  const matches = [...source.matchAll(pattern)];
  return matches.sort((a, b) => a[1].length - b[1].length)[0]?.[2];
}

const topLevelId = (source: string) =>
  topLevel(source, /^([ \t]*)id:\s*["']([^"']+)["']/gm);

const NAME_BLOCKS = /^([ \t]*)name:\s*\{([^}]*)\}/gm;

// Guillemets simples ou doubles : « Farfetch'd » s'écrit entre guillemets doubles.
const translation = (names: string, language: string) => {
  const match = new RegExp(
    `(?:^|[\\s,{])${language}:\\s*(?:"([^"]*)"|'([^']*)')`,
  ).exec(names);
  return match ? (match[1] ?? match[2]) : null;
};

const localizedName = (source: string, language: string) =>
  translation(topLevel(source, NAME_BLOCKS) ?? '', language);

// Les blocs `name` plus indentés que celui de la carte sont ses talents et attaques.
function moveNames(source: string): string[] {
  const blocks = [...source.matchAll(NAME_BLOCKS)].sort(
    (a, b) => a[1].length - b[1].length,
  );
  return blocks
    .slice(1)
    .map(([, , names]) => translation(names, 'en'))
    .filter((name): name is string => name !== null);
}

const officialAbbreviation = (setSource: string) =>
  /abbreviations:\s*\{[^}]*official:\s*["']([^"']+)["']/.exec(setSource)?.[1];
