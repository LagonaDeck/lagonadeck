import { cardmarketLinks, readTarFiles, tcgdexCards } from './card-details';

// Entrée tar minimale : en-tête ustar de 512 octets puis contenu complété.
function tarEntry(path: string, content: string, type = '0'): Buffer {
  const body = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(path, 0);
  header.write(body.length.toString(8).padStart(11, '0'), 124);
  header.write(type, 156);
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([header, body, padding]);
}

const pax = (path: string) => {
  const record = ` path=${path}\n`;
  const length = String(record.length + 3).length + record.length;
  return tarEntry('PaxHeader', `${length}${record}`, 'x');
};

const tar = (...entries: Buffer[]) =>
  Buffer.concat([...entries, Buffer.alloc(1024)]);

describe('readTarFiles', () => {
  it('lit les fichiers retenus, chemins longs (pax) compris', () => {
    const longPath = `repo/data/${'Série très longue '.repeat(6)}/006.ts`;
    const files = readTarFiles(
      tar(
        tarEntry('repo/README.md', 'ignoré'),
        tarEntry('repo/data/Base.ts', 'id: "base"'),
        pax(longPath),
        tarEntry('repo/data/tronque', 'cardmarket: 1'),
      ),
      (path) => path.endsWith('.ts'),
    );

    expect([...files]).toEqual([
      ['repo/data/Base.ts', 'id: "base"'],
      [longPath, 'cardmarket: 1'],
    ]);
  });
});

const card = (...lines: string[]) => lines.join('\n');

const ARCHIVE = new Map([
  ['repo/data/Platinum.ts', card('const serie = {', '\tid: "pl",', '}')],
  [
    'repo/data/Platinum/Supreme Victors.ts',
    card(
      'const set = {',
      '\tid: "pl3",',
      '\tname: {',
      '\t\ten: "Supreme Victors",',
      '\t\tfr: "Vainqueurs Suprêmes",',
      '\t},',
      '\tabbreviations: {',
      '\t\tofficial: "SV"',
      '\t}',
      '}',
    ),
  ],
  [
    'repo/data/Platinum/Supreme Victors/27.ts',
    card(
      'const card = {',
      '\tname: {',
      '\t\ten: "Empoleon FB",',
      '\t\tfr: "Pingoléon FB",',
      '\t},',
      '\trarity: "Rare",',
      '\tattacks: [{',
      '\t\tname: {',
      '\t\t\ten: "Rushing Water",',
      '\t\t},',
      '\t}, {',
      '\t\tname: {',
      '\t\t\ten: "Escort",',
      '\t\t},',
      '\t}],',
      '\tvariants: [',
      '\t\t{ type: "reverse", foil: "league", thirdParty: { cardmarket: 371554 } },',
      '\t\t{ type: "normal", thirdParty: { cardmarket: 278718 } },',
      '\t],',
      '}',
    ),
  ],
  [
    'repo/data-asia/SM.ts',
    card(
      'const serie: Serie = {',
      '\tname: {',
      "\t\tid: 'Matahari & Bulan',",
      '\t},',
      "\tid: 'SM'",
      '}',
    ),
  ],
  ['repo/data-asia/SM/SM8.ts', card('const set = {', "\tid: 'SM8',", '}')],
  [
    'repo/data-asia/SM/SM8/001.ts',
    card(
      'const card = {',
      '\tname: {',
      '\t\tja: "フシギダネ",',
      '\t},',
      '\trarity: "None",',
      '\tthirdParty: { cardmarket: 400001 }',
      '}',
    ),
  ],
  [
    'repo/data/Pokémon TCG Pocket.ts',
    card('const serie = {', '\tid: "tcgp",', '}'),
  ],
  [
    'repo/data/Pokémon TCG Pocket/Genetic Apex.ts',
    card('const set = {', '\tid: "A1",', '}'),
  ],
  [
    'repo/data/Pokémon TCG Pocket/Genetic Apex/001.ts',
    card('const card = {', '\tname: {', '\t\ten: "Bulbasaur",', '\t},', '}'),
  ],
]);

describe('tcgdexCards', () => {
  const cards = tcgdexCards(ARCHIVE);

  it('identifie la carte par son set et son numéro, avec son nom français', () => {
    expect(cards[0]).toEqual({
      tcgdexId: 'en/pl3-27',
      name: 'Pingoléon FB',
      englishName: 'Empoleon FB',
      setCode: 'SV',
      setName: 'Vainqueurs Suprêmes',
      cardNumber: '27',
      rarity: 'Rare',
      imageUrl: 'https://assets.tcgdex.net/en/pl/pl3/27/high.webp',
      hasReverse: false,
      moves: ['Rushing Water', 'Escort'],
      cardmarketIds: [278718, 371554],
    });
  });

  it('garde les cartes japonaises sous leur nom, avec le code de leur set', () => {
    expect(cards[1]).toEqual(
      expect.objectContaining({
        tcgdexId: 'ja/SM8-001',
        name: 'フシギダネ',
        englishName: null,
        setCode: 'SM8',
        rarity: null,
        hasReverse: null,
        cardmarketIds: [400001],
      }),
    );
  });

  it.each([
    [
      'une variante reverse',
      [
        '\tvariants: [{',
        '\t\ttype: "normal",',
        '\t},',
        '\t{',
        '\t\ttype: "reverse",',
        '\t}],',
      ],
      true,
    ],
    [
      'une reverse sur une ligne',
      ['\tvariants: [{ type: "holo" }, { type: \'reverse\' }],'],
      true,
    ],
    [
      'l’ancien format',
      ['\tvariants: {', '\t\tnormal: true,', '\t\treverse: true,', '\t},'],
      true,
    ],
    [
      'une reverse spéciale seulement, vendue à part',
      [
        '\tvariants: [{ type: "normal" }, { type: "reverse", foil: "pokeball" }],',
      ],
      false,
    ],
    ['des variantes sans reverse', ['\tvariants: [{ type: "holo" }],'], false],
    ['aucune variante listée', [], null],
  ])('repère la reverse : %s', (_, variants, hasReverse) => {
    const [serie, set] = [...ARCHIVE].slice(0, 2);
    const archive = new Map([
      serie,
      set,
      [
        'repo/data/Platinum/Supreme Victors/1.ts',
        card(
          'const card = {',
          '\tname: { en: "Bulbasaur" },',
          ...variants,
          '}',
        ),
      ],
    ]);

    expect(tcgdexCards(archive)[0].hasReverse).toBe(hasReverse);
  });

  it('écarte Pokémon TCG Pocket, un jeu mobile', () => {
    expect(cards.map(({ tcgdexId }) => tcgdexId)).toEqual([
      'en/pl3-27',
      'ja/SM8-001',
    ]);
  });
});

describe('cardmarketLinks', () => {
  const mewtwo = (id: string, moves: string[]) => ({
    id,
    moves,
    tcgdexCardmarketIds: [286307],
  });
  const names = new Map([
    [286307, 'Mewtwo EX [Photon Wave | Psyburn]'],
    [278718, 'Empoleon [FB] Lv.50 [Rushing Water | Escort]'],
    [371554, 'Empoleon [FB] Lv.50 [Rushing Water | Escort]'],
    [274023, 'Weedle [Poison Sting | Base Set]'],
    [471609, 'Acerola'],
  ]);

  it('lie la variante de base dont les attaques sont celles de la carte', () => {
    const links = cardmarketLinks(
      [
        {
          id: 'empoleon',
          moves: ['Rushing Water', 'Escort'],
          tcgdexCardmarketIds: [278718, 371554],
        },
      ],
      names,
      new Set(),
    );

    expect(links).toEqual(new Map([['empoleon', 278718]]));
  });

  it('ne lie pas un produit Cardmarket dont les attaques diffèrent', () => {
    const links = cardmarketLinks(
      [mewtwo('bkt-62', ['Shatter Shot', 'Damage Change'])],
      names,
      new Set(),
    );

    expect(links.size).toBe(0);
  });

  it('ne lie aucune carte quand plusieurs revendiquent le même produit', () => {
    const links = cardmarketLinks(
      [
        mewtwo('bkt-61', ['Photon Wave', 'Psyburn']),
        mewtwo('bkt-157', ['Photon Wave', 'Psyburn']),
      ],
      names,
      new Set(),
    );

    expect(links.size).toBe(0);
  });

  it('tolère le nom du set et les écarts de ponctuation de Cardmarket', () => {
    const links = cardmarketLinks(
      [
        {
          id: 'weedle',
          moves: ['Poison-Sting'],
          tcgdexCardmarketIds: [274023],
        },
        { id: 'acerola', moves: [], tcgdexCardmarketIds: [471609] },
      ],
      names,
      new Set(),
    );

    expect(links).toEqual(
      new Map([
        ['weedle', 274023],
        ['acerola', 471609],
      ]),
    );
  });

  it('ne reprend pas un produit lié à la main ailleurs', () => {
    const links = cardmarketLinks(
      [{ id: 'acerola', moves: [], tcgdexCardmarketIds: [471609] }],
      names,
      new Set([471609]),
    );

    expect(links.size).toBe(0);
  });

  it('ne lie pas un produit absent du catalogue Cardmarket', () => {
    const links = cardmarketLinks(
      [{ id: 'inconnue', moves: [], tcgdexCardmarketIds: [999] }],
      names,
      new Set(),
    );

    expect(links.size).toBe(0);
  });
});
