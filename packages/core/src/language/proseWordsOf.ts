type DelimitedParams = {
  readonly text: string;
  readonly delimiter: string;
};

const withoutDelimited = ({ text, delimiter }: DelimitedParams): string => {
  let rest = text;
  let kept = '';
  while (rest.length > 0) {
    const open = rest.indexOf(delimiter);
    if (open === -1) {
      return kept + rest;
    }
    const close = rest.indexOf(delimiter, open + delimiter.length);
    if (close === -1) {
      return `${kept}${rest.slice(0, open)} ${rest.slice(open + delimiter.length)}`;
    }
    kept += `${rest.slice(0, open)} `;
    rest = rest.slice(close + delimiter.length);
  }
  return kept;
};

type CharParams = { readonly char: string | undefined };

const isLetter = ({ char }: CharParams): boolean =>
  char != null && char.toLowerCase() !== char.toUpperCase();

const isUpper = ({ char }: CharParams): boolean =>
  isLetter({ char }) && char === char?.toUpperCase();

const isLower = ({ char }: CharParams): boolean =>
  isLetter({ char }) && char === char?.toLowerCase();

const isDigit = ({ char }: CharParams): boolean => char != null && char >= '0' && char <= '9';

const JOINER_CHARS = '.-:';
const PATH_CHARS = '/\\_@#=<>{}[]|*~$%^&';

type ChunkParams = { readonly chunk: string };

const isTechnicalChunk = ({ chunk }: ChunkParams): boolean => {
  for (let index = 0; index < chunk.length; index += 1) {
    const char = chunk[index];
    const previous = chunk[index - 1];
    const next = chunk[index + 1];
    if (char == null) {
      continue;
    }
    if (PATH_CHARS.includes(char) || isDigit({ char })) {
      return true;
    }
    if (JOINER_CHARS.includes(char) && isLetter({ char: previous }) && isLetter({ char: next })) {
      return true;
    }
    if (isLower({ char: previous }) && isUpper({ char })) {
      return true;
    }
  }
  return false;
};

type ProseParams = { readonly text: string };

export const proseWordsOf = ({ text }: ProseParams): ReadonlyArray<string> => {
  const noFences = withoutDelimited({ text, delimiter: '```' });
  const noSpans = withoutDelimited({ text: noFences, delimiter: '`' });
  const words: Array<string> = [];
  for (const chunk of noSpans.split(/\s+/)) {
    if (isTechnicalChunk({ chunk })) {
      continue;
    }
    for (const word of chunk.match(/\p{L}+/gu) ?? []) {
      words.push(word.toLowerCase());
    }
  }
  return words;
};
