export type GoalBranchMatch =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'one'; branch: string }>
  | Readonly<{ kind: 'many'; branches: ReadonlyArray<string> }>;

type Params = {
  readonly goal: string;
  readonly branches: ReadonlyArray<string>;
  readonly baseBranch: string | null;
};

type TokenParams = {
  readonly raw: string;
};

type Token = {
  readonly text: string;
  readonly isQuoted: boolean;
};

const NO_MATCH: GoalBranchMatch = { kind: 'none' };

const QUOTES = new Set(['`', '"', "'", '“', '”', '‘', '’']);

const EDGES = new Set([
  ...QUOTES,
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '<',
  '>',
  ',',
  ';',
  '.',
  '!',
  '?',
  '*',
]);

const DEFAULT_BRANCHES: ReadonlySet<string> = new Set([
  'main',
  'master',
  'develop',
  'development',
  'trunk',
]);

const REMOTE_PREFIX = 'origin/';

const SEPARATORS = ['/', '-', '_', '.'];

const trimEdges = ({ raw }: TokenParams): string => {
  let start = 0;
  let end = raw.length;
  while (start < end && EDGES.has(raw.charAt(start))) {
    start += 1;
  }
  while (end > start && EDGES.has(raw.charAt(end - 1))) {
    end -= 1;
  }
  return raw.slice(start, end);
};

const goalWordsOf = ({ goal }: Pick<Params, 'goal'>): ReadonlyArray<Token> =>
  goal
    .split(/\s+/)
    .flatMap((word) => word.split(':'))
    .map((raw) => ({
      text: trimEdges({ raw }),
      isQuoted: QUOTES.has(raw.charAt(0)) || QUOTES.has(raw.charAt(raw.length - 1)),
    }))
    .filter((token) => token.text !== '');

const isBareWord = ({ text }: Pick<Token, 'text'>): boolean =>
  !SEPARATORS.some((separator) => text.includes(separator));

export const branchNamedInGoal = ({ goal, branches, baseBranch }: Params): GoalBranchMatch => {
  const known = new Set(branches);
  const found = new Set<string>();
  for (const token of goalWordsOf({ goal })) {
    const text =
      !known.has(token.text) && token.text.startsWith(REMOTE_PREFIX)
        ? token.text.slice(REMOTE_PREFIX.length)
        : token.text;
    if (!known.has(text) || text === baseBranch || DEFAULT_BRANCHES.has(text)) {
      continue;
    }
    if (isBareWord({ text }) && !token.isQuoted) {
      continue;
    }
    found.add(text);
  }
  const names = [...found];
  if (names.length === 0) {
    return NO_MATCH;
  }
  const [only] = names;
  return names.length === 1 && only !== undefined
    ? { kind: 'one', branch: only }
    : { kind: 'many', branches: names };
};
