const WHITESPACE = /\s/;

const MAX_HEADING_HASHES = 6;

type TextParams = {
  readonly text: string;
};

type IndexParams = TextParams & {
  readonly index: number;
};

type EndParams = TextParams & {
  readonly start: number;
  readonly end: number;
};

const isSpaceAt = ({ text, index }: IndexParams): boolean =>
  index >= 0 && index < text.length && WHITESPACE.test(text.charAt(index));

const hashRunEndOf = ({ text, index }: IndexParams): number => {
  let end = index;
  while (text.charAt(end) === '#') {
    end += 1;
  }
  return end;
};

const leadingTokenLengthOf = ({ text, index }: IndexParams): number => {
  const char = text.charAt(index);
  if (isSpaceAt({ text, index })) {
    return 1;
  }
  if (char === '#') {
    const runEnd = hashRunEndOf({ text, index });
    const run = runEnd - index;
    return run <= MAX_HEADING_HASHES && isSpaceAt({ text, index: runEnd }) ? run + 1 : 0;
  }
  if ((char === '>' || char === '*' || char === '-') && isSpaceAt({ text, index: index + 1 })) {
    return 2;
  }
  if (
    text.startsWith('**', index) ||
    text.startsWith('__', index) ||
    text.startsWith('~~', index)
  ) {
    return 2;
  }
  return char === '`' ? 1 : 0;
};

const trailingTokenLengthOf = ({ text, start, end }: EndParams): number => {
  if (isSpaceAt({ text, index: end - 1 }) || text.charAt(end - 1) === '`') {
    return 1;
  }
  if (end - 2 < start) {
    return 0;
  }
  const pair = text.slice(end - 2, end);
  return pair === '**' || pair === '__' || pair === '~~' ? 2 : 0;
};

export const stripMarkdownEdges = ({ text }: TextParams): string => {
  let start = 0;
  while (start < text.length) {
    const length = leadingTokenLengthOf({ text, index: start });
    if (length === 0) {
      break;
    }
    start += length;
  }
  let end = text.length;
  while (end > start) {
    const length = trailingTokenLengthOf({ text, start, end });
    if (length === 0) {
      break;
    }
    end -= length;
  }
  return text.slice(start, end);
};
