export type RunIdentity = {
  readonly stroke: string;
  readonly chip: string;
  readonly index: number;
};

const IDENTITIES: ReadonlyArray<RunIdentity> = [
  { stroke: 'var(--color-run-1)', chip: 'bg-run-1/12 text-run-1 ring-run-1/35', index: 0 },
  { stroke: 'var(--color-run-2)', chip: 'bg-run-2/12 text-run-2 ring-run-2/35', index: 1 },
  { stroke: 'var(--color-run-3)', chip: 'bg-run-3/12 text-run-3 ring-run-3/35', index: 2 },
  { stroke: 'var(--color-run-4)', chip: 'bg-run-4/12 text-run-4 ring-run-4/35', index: 3 },
  { stroke: 'var(--color-run-5)', chip: 'bg-run-5/12 text-run-5 ring-run-5/35', index: 4 },
  { stroke: 'var(--color-run-6)', chip: 'bg-run-6/12 text-run-6 ring-run-6/35', index: 5 },
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
