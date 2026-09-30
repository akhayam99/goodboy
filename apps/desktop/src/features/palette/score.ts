type TextMatch = {
  readonly score: number;
  readonly positions: ReadonlyArray<number>;
  readonly isWordPrefix: boolean;
};

export type FieldsMatch = TextMatch & {
  readonly isOnLabel: boolean;
};

type ScoreTextParams = {
  readonly query: string;
  readonly text: string;
};

type ScoreFieldsParams = {
  readonly query: string;
  readonly label: string;
  readonly secondary: ReadonlyArray<string>;
};

type TokenParams = {
  readonly token: string;
  readonly text: string;
};

type IndexParams = {
  readonly text: string;
  readonly index: number;
};

type SubsequenceParams = {
  readonly token: string;
  readonly lower: string;
};

type SecondaryParams = {
  readonly token: string;
  readonly secondary: ReadonlyArray<string>;
};

type WholeQueryParams = {
  readonly query: string;
  readonly lower: string;
};

type WordPrefixParams = {
  readonly token: string;
  readonly text: string;
};

const CHAR = 16;
const WORD_START = 16;
const CAMEL = 12;
const FIRST_CHAR = 6;
const RUN = 6;
const GAP_OPEN = 3;
const GAP_EXTEND = 1;
const EXACT = 60;
const PREFIX = 40;
const CONTIGUOUS = 20;
const SECONDARY_WEIGHT = 0.5;
const NONE = Number.NEGATIVE_INFINITY;

const ALNUM = /[\p{L}\p{N}]/u;

const isAlnum = (ch: string): boolean => ch.length > 0 && ALNUM.test(ch);

const isUpper = (ch: string): boolean => ch !== ch.toLowerCase() && ch === ch.toUpperCase();

const positionBonus = ({ text, index }: IndexParams): number => {
  if (index === 0) {
    return WORD_START + FIRST_CHAR;
  }
  const previous = text[index - 1] ?? '';
  const current = text[index] ?? '';
  if (!isAlnum(previous) && isAlnum(current)) {
    return WORD_START;
  }
  if (isUpper(current) && isAlnum(previous) && !isUpper(previous)) {
    return CAMEL;
  }
  return 0;
};

const isWordPrefix = ({ token, text }: WordPrefixParams): boolean => {
  const lower = text.toLowerCase();
  for (let index = lower.indexOf(token); index >= 0; index = lower.indexOf(token, index + 1)) {
    if (positionBonus({ text, index }) >= CAMEL) {
      return true;
    }
  }
  return false;
};

const isSubsequence = ({ token, lower }: SubsequenceParams): boolean => {
  let cursor = 0;
  for (let index = 0; index < lower.length && cursor < token.length; index += 1) {
    if (lower[index] === token[cursor]) {
      cursor += 1;
    }
  }
  return cursor === token.length;
};

const matchToken = ({ token, text }: TokenParams): TextMatch | null => {
  const lower = text.toLowerCase();
  const m = token.length;
  const n = lower.length;
  if (m === 0) {
    return { score: 0, positions: [], isWordPrefix: true };
  }
  if (m > n || !isSubsequence({ token, lower })) {
    return null;
  }
  const bonus = new Float64Array(n);
  for (let j = 0; j < n; j += 1) {
    bonus[j] = positionBonus({ text, index: j });
  }
  const scores = new Float64Array(m * n).fill(NONE);
  const fromRun = new Uint8Array(m * n);
  for (let j = 0; j < n; j += 1) {
    if (lower[j] === token[0]) {
      scores[j] = CHAR + (bonus[j] ?? 0);
    }
  }
  for (let i = 1; i < m; i += 1) {
    let gapBest = NONE;
    for (let j = 1; j < n; j += 1) {
      if (j >= 2) {
        gapBest = Math.max(gapBest - GAP_EXTEND, scores[(i - 1) * n + (j - 2)] ?? NONE);
      }
      if (lower[j] !== token[i]) {
        continue;
      }
      const run = (scores[(i - 1) * n + (j - 1)] ?? NONE) + RUN;
      const gap = gapBest - GAP_OPEN;
      const best = Math.max(run, gap);
      if (best === NONE) {
        continue;
      }
      scores[i * n + j] = best + CHAR + (bonus[j] ?? 0);
      fromRun[i * n + j] = run >= gap ? 1 : 0;
    }
  }
  let end = -1;
  let endScore = NONE;
  for (let j = 0; j < n; j += 1) {
    const value = scores[(m - 1) * n + j] ?? NONE;
    if (value > endScore) {
      endScore = value;
      end = j;
    }
  }
  if (end < 0) {
    return null;
  }
  const positions = new Array<number>(m).fill(0);
  let j = end;
  for (let i = m - 1; i >= 0; i -= 1) {
    positions[i] = j;
    if (i === 0) {
      break;
    }
    if (fromRun[i * n + j] === 1) {
      j -= 1;
      continue;
    }
    const target = (scores[i * n + j] ?? NONE) - CHAR - (bonus[j] ?? 0) + GAP_OPEN;
    let found = j - 2;
    for (let k = j - 2; k >= 0; k -= 1) {
      const candidate = (scores[(i - 1) * n + k] ?? NONE) - GAP_EXTEND * (j - 2 - k);
      if (Math.abs(candidate - target) < 1e-9) {
        found = k;
        break;
      }
    }
    j = found;
  }
  return {
    score: endScore,
    positions,
    isWordPrefix: isWordPrefix({ token, text }),
  };
};

const queryTokens = (query: string): ReadonlyArray<string> =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);

const wholeQueryBonus = ({ query, lower }: WholeQueryParams): number => {
  const normalized = queryTokens(query).join(' ');
  if (normalized.length === 0) {
    return 0;
  }
  if (lower === normalized) {
    return EXACT + PREFIX;
  }
  if (lower.startsWith(normalized)) {
    return PREFIX;
  }
  if (lower.includes(normalized)) {
    return CONTIGUOUS;
  }
  return 0;
};

export const scoreText = ({ query, text }: ScoreTextParams): TextMatch | null => {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return { score: 0, positions: [], isWordPrefix: true };
  }
  const positions = new Set<number>();
  let score = 0;
  let isWordPrefix = true;
  for (const token of tokens) {
    const match = matchToken({ token, text });
    if (match === null) {
      return null;
    }
    score += match.score;
    isWordPrefix = isWordPrefix && match.isWordPrefix;
    match.positions.forEach((position) => positions.add(position));
  }
  return {
    score: score + wholeQueryBonus({ query, lower: text.toLowerCase() }),
    positions: [...positions].sort((a, b) => a - b),
    isWordPrefix,
  };
};

const bestSecondary = ({ token, secondary }: SecondaryParams): TextMatch | null =>
  secondary.reduce<TextMatch | null>((best, text) => {
    const match = matchToken({ token, text });
    if (match === null) {
      return best;
    }
    const weighted = { ...match, score: match.score * SECONDARY_WEIGHT };
    return best === null || weighted.score > best.score ? weighted : best;
  }, null);

export const scoreFields = ({ query, label, secondary }: ScoreFieldsParams): FieldsMatch | null => {
  const whole = scoreText({ query, text: label });
  if (whole !== null) {
    return { ...whole, isOnLabel: true };
  }
  const tokens = queryTokens(query);
  const positions = new Set<number>();
  let score = 0;
  let isOnLabel = false;
  for (const token of tokens) {
    const onLabel = matchToken({ token, text: label });
    const onSecondary = bestSecondary({ token, secondary });
    const pick =
      onLabel !== null && (onSecondary === null || onLabel.score >= onSecondary.score)
        ? onLabel
        : onSecondary;
    if (pick === null) {
      return null;
    }
    score += pick.score;
    if (pick === onLabel) {
      isOnLabel = true;
      pick.positions.forEach((position) => positions.add(position));
    }
  }
  return {
    score,
    positions: [...positions].sort((a, b) => a - b),
    isWordPrefix: tokens.every((token) => isWordPrefix({ token, text: label })),
    isOnLabel,
  };
};
