import { markdownPlainLinesOf } from '../../shared/utils/markdownPreview';

export type CommentScopeSign = 'rethink' | 'places' | 'long';

export type CommentScope = {
  readonly isBroad: boolean;
  readonly signs: ReadonlyArray<CommentScopeSign>;
  readonly places: ReadonlyArray<string>;
};

type Params = {
  readonly body: string;
  readonly path: string | null;
};

type WordsParams = {
  readonly words: ReadonlyArray<string>;
};

type WordParams = {
  readonly word: string;
};

type AtParams = WordsParams & {
  readonly at: number;
};

type OwnParams = {
  readonly path: string | null;
};

type TextParams = {
  readonly text: string;
};

type PlacesParams = WordsParams & {
  readonly lower: ReadonlyArray<string>;
  readonly own: ReadonlySet<string>;
};

type OwnFileParams = Pick<PlacesParams, 'own'> & {
  readonly key: string;
};

const LONG_AT = 400;
const SIGNS_FOR_BROAD = 2;
const MOVE_REACH = 4;
const WAY_REACH = 6;

const RETHINK_WORDS: ReadonlySet<string> = new Set([
  'rewrite',
  'rewrites',
  'rewriting',
  'rethink',
  'redesign',
  'restructure',
  'rework',
  'riscrivi',
  'riscrivere',
  'ripensa',
  'ripensare',
  'rifai',
  'rifare',
]);

const NEW_WORDS: ReadonlySet<string> = new Set(['new', 'nuovi', 'nuovo', 'nuove']);
const PART_WORDS: ReadonlySet<string> = new Set([
  'component',
  'components',
  'componente',
  'componenti',
]);
const MODEL_WORDS: ReadonlySet<string> = new Set(['model', 'example', 'reference', 'template']);
const MOVE_WORDS: ReadonlySet<string> = new Set(['move', 'sposta', 'spostare']);
const INTO_WORDS: ReadonlySet<string> = new Set(['into', 'in', 'nel', 'nella', 'nello', 'dentro']);
const POINTER_WORDS: ReadonlySet<string> = new Set([
  'this',
  'the',
  'that',
  'these',
  'those',
  'questo',
  'questa',
  'quel',
  'quella',
  'il',
  'la',
  'lo',
  'l',
]);
const SMALL_OBJECTS: ReadonlySet<string> = new Set([
  'import',
  'imports',
  'line',
  'lines',
  'call',
  'const',
  'constant',
  'variable',
  'type',
  'check',
  'test',
  'comment',
  'helper',
  'function',
  'prop',
  'class',
  'riga',
  'righe',
  'chiamata',
  'costante',
  'variabile',
  'tipo',
  'funzione',
]);
const ROUTE_WORDS: ReadonlySet<string> = new Set(['route', 'routes']);
const ARTICLE_WORDS: ReadonlySet<string> = new Set(['a', 'an', 'one', 'each', 'every', 'new']);
const FILE_ENDINGS: ReadonlyArray<string> = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.rs',
  '.css',
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.py',
  '.go',
  '.html',
];

const plainOf = ({ body }: Pick<Params, 'body'>): string =>
  markdownPlainLinesOf({ text: body, shouldKeepOpenFence: false }).join(' ').trim();

const trimmedOf = ({ word }: WordParams): string => {
  let start = 0;
  let end = word.length;
  while (start < end && '.-_/'.includes(word.charAt(start))) {
    start += 1;
  }
  while (end > start && '.-_/'.includes(word.charAt(end - 1))) {
    end -= 1;
  }
  return word.slice(start, end);
};

const wordsOf = ({ text }: TextParams): ReadonlyArray<string> =>
  text
    .split(/[^\p{L}\p{N}./_-]+/u)
    .map((word) => trimmedOf({ word }))
    .filter((word) => word !== '');

const lowerOf = ({ words }: WordsParams): ReadonlyArray<string> =>
  words.map((word) => word.toLowerCase());

const isUpper = ({ word }: WordParams): boolean => word >= 'A' && word <= 'Z';

const isPascalName = ({ word }: WordParams): boolean => {
  if (!isUpper({ word: word.charAt(0) })) {
    return false;
  }
  const chars = [...word];
  const isPlain = chars.every((char) => /[\p{L}\p{N}]/u.test(char));
  const uppers = chars.filter((char) => isUpper({ word: char })).length;
  return isPlain && uppers >= 2 && uppers < chars.length;
};

const isFileName = ({ word }: WordParams): boolean => {
  const lower = word.toLowerCase();
  return FILE_ENDINGS.some((ending) => lower.endsWith(ending) && lower.length > ending.length);
};

const isPathName = ({ word }: WordParams): boolean =>
  word.includes('/') && /\p{L}/u.test(word) && !word.startsWith('http');

const ownNamesOf = ({ path }: OwnParams): ReadonlySet<string> => {
  if (path === null || path === '') {
    return new Set();
  }
  const base = path.split('/').pop() ?? path;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return new Set([path.toLowerCase(), base.toLowerCase(), stem.toLowerCase()]);
};

const isSmallMove = ({ words, at }: AtParams): boolean => {
  let next = at + 1;
  while (next < words.length && POINTER_WORDS.has(words[next] ?? '')) {
    next += 1;
  }
  return SMALL_OBJECTS.has(words[next] ?? '');
};

const isMoveInto = ({ words, at }: AtParams): boolean =>
  MOVE_WORDS.has(words[at] ?? '') &&
  !isSmallMove({ words, at }) &&
  words.slice(at + 1, at + 1 + MOVE_REACH).some((word) => INTO_WORDS.has(word));

const isNewParts = ({ words, at }: AtParams): boolean =>
  NEW_WORDS.has(words[at] ?? '') && PART_WORDS.has(words[at + 1] ?? '');

const isAsModel = ({ words, at }: AtParams): boolean =>
  (words[at] === 'as' &&
    (words[at + 1] === 'the' || words[at + 1] === 'a') &&
    MODEL_WORDS.has(words[at + 2] ?? '')) ||
  (words[at] === 'come' && words[at + 1] === 'modello');

const isTheWay = ({ words, at }: AtParams): boolean =>
  words[at] === 'the' &&
  words[at + 1] === 'way' &&
  words
    .slice(at + 2, at + 2 + WAY_REACH)
    .some((word, index) => (word === 'does' || word === 'do') && words[at + 3 + index] === 'it');

const hasRethink = ({ words }: WordsParams): boolean =>
  words.some(
    (word, at) =>
      RETHINK_WORDS.has(word) ||
      isMoveInto({ words, at }) ||
      isNewParts({ words, at }) ||
      isAsModel({ words, at }) ||
      isTheWay({ words, at }),
  );

const isRouteName = ({ word }: WordParams): boolean =>
  word !== '' && !POINTER_WORDS.has(word) && !ARTICLE_WORDS.has(word) && /\p{L}/u.test(word);

const isOwnFile = ({ key, own }: OwnFileParams): boolean => {
  const last = key.split('/').pop() ?? key;
  const dot = last.lastIndexOf('.');
  return own.has(key) || own.has(last) || (dot > 0 && own.has(last.slice(0, dot)));
};

const placesOf = ({ words, lower, own }: PlacesParams): ReadonlyArray<string> => {
  const found = words.flatMap((word, at): ReadonlyArray<string> => {
    const key = lower[at] ?? '';
    if (isFileName({ word }) || isPathName({ word })) {
      return isOwnFile({ key, own }) ? [] : [word];
    }
    if (isPascalName({ word })) {
      return own.has(key) ? [] : [word];
    }
    const before = lower[at - 1] ?? '';
    return ROUTE_WORDS.has(key) && isRouteName({ word: before }) ? [`the ${before} route`] : [];
  });
  return [...new Set(found)];
};

const SIGN_ORDER: ReadonlyArray<CommentScopeSign> = ['rethink', 'places', 'long'];

export const commentScopeOf = ({ body, path }: Params): CommentScope => {
  const plain = plainOf({ body });
  const words = wordsOf({ text: plain });
  const lower = lowerOf({ words });
  const places = placesOf({ words, lower, own: ownNamesOf({ path }) });
  const isSign: Readonly<Record<CommentScopeSign, boolean>> = {
    rethink: hasRethink({ words: lower }),
    places: places.length > 0,
    long: plain.length > LONG_AT,
  };
  const signs = SIGN_ORDER.filter((sign) => isSign[sign]);
  return { isBroad: signs.length >= SIGNS_FOR_BROAD, signs, places };
};
