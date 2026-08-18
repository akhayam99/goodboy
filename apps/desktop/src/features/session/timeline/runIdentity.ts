export type RunIdentity = {
  readonly stroke: string;
  readonly index: number;
};

const IDENTITIES: ReadonlyArray<RunIdentity> = [
  { stroke: 'var(--color-run-1)', index: 0 },
  { stroke: 'var(--color-run-2)', index: 1 },
  { stroke: 'var(--color-run-3)', index: 2 },
  { stroke: 'var(--color-run-4)', index: 3 },
  { stroke: 'var(--color-run-5)', index: 4 },
  { stroke: 'var(--color-run-6)', index: 5 },
];

type Params = {
  readonly runId: string;
};

export const runIdentity = ({ runId }: Params): RunIdentity => {
  let hash = 0;
  for (let position = 0; position < runId.length; position += 1) {
    hash = (hash * 31 + runId.charCodeAt(position)) % 1_000_003;
  }
  const identity = IDENTITIES[hash % IDENTITIES.length];
  if (identity === undefined) {
    throw new Error('run identity palette is empty');
  }
  return identity;
};

type StrokeParams = {
  readonly index: number;
};

export const runIdentityStroke = ({ index }: StrokeParams): string =>
  IDENTITIES[index]?.stroke ?? 'var(--color-border)';
