export type RunIdentity = {
  readonly spine: string;
  readonly text: string;
  readonly index: number;
};

const IDENTITIES: ReadonlyArray<RunIdentity> = [
  { spine: 'bg-run-1', text: 'text-run-1', index: 0 },
  { spine: 'bg-run-2', text: 'text-run-2', index: 1 },
  { spine: 'bg-run-3', text: 'text-run-3', index: 2 },
  { spine: 'bg-run-4', text: 'text-run-4', index: 3 },
  { spine: 'bg-run-5', text: 'text-run-5', index: 4 },
  { spine: 'bg-run-6', text: 'text-run-6', index: 5 },
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
