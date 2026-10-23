type Params = {
  readonly text: string;
  readonly sectionLabel: string;
};

type FenceChar = '`' | '~';

type Fence = {
  readonly char: FenceChar;
  readonly length: number;
};

type FenceLine = Fence & {
  readonly rest: string;
};

type LineParams = {
  readonly line: string;
};

const MAX_INDENT = 3;
const MIN_FENCE = 3;

const fenceLineOf = ({ line }: LineParams): FenceLine | null => {
  const trimmed = line.trimStart();
  if (line.length - trimmed.length > MAX_INDENT) {
    return null;
  }
  const first = trimmed.charAt(0);
  if (first !== '`' && first !== '~') {
    return null;
  }
  let length = 0;
  while (trimmed.charAt(length) === first) {
    length += 1;
  }
  if (length < MIN_FENCE) {
    return null;
  }
  return { char: first, length, rest: trimmed.slice(length) };
};

const openingFenceOf = ({ line }: LineParams): Fence | null => {
  const found = fenceLineOf({ line });
  if (found === null || (found.char === '`' && found.rest.includes('`'))) {
    return null;
  }
  return { char: found.char, length: found.length };
};

type ClosingParams = LineParams & {
  readonly open: Fence;
};

const isClosingFence = ({ line, open }: ClosingParams): boolean => {
  const found = fenceLineOf({ line });
  return (
    found !== null &&
    found.char === open.char &&
    found.length >= open.length &&
    found.rest.trim() === ''
  );
};

const headingWordsOf = ({ line }: LineParams): string | null => {
  const trimmed = line.trimStart();
  if (line.length - trimmed.length > 3 || !trimmed.startsWith('#')) {
    return null;
  }
  const hashes = trimmed.length - trimmed.replace(/^#+/, '').length;
  if (hashes > 6 || trimmed.charAt(hashes) !== ' ') {
    return null;
  }
  const words = trimmed.slice(hashes + 1).trim();
  return words === '' ? null : words.replace(/\s#+$/, '').trim();
};

export const demoteBodyHeadings = ({ text, sectionLabel }: Params): string => {
  let openFence: Fence | null = null;
  let isFirstContent = true;
  const lines = text.split('\n').flatMap((line) => {
    if (openFence !== null) {
      if (isClosingFence({ line, open: openFence })) {
        openFence = null;
      }
      return [line];
    }
    const opening = openingFenceOf({ line });
    if (opening !== null) {
      openFence = opening;
      isFirstContent = false;
      return [line];
    }
    const words = headingWordsOf({ line });
    const isFirst = isFirstContent && line.trim() !== '';
    if (line.trim() !== '') {
      isFirstContent = false;
    }
    if (words === null) {
      return [line];
    }
    if (isFirst && words.toLowerCase() === sectionLabel.toLowerCase()) {
      return [];
    }
    return [`**${words}**`];
  });
  return lines.join('\n').trim();
};
