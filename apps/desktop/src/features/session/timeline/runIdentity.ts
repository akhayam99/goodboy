export type RunIdentity = {
  readonly stroke: string;
  readonly chip: string;
  readonly mutedChip: string;
  readonly spin: string;
  readonly index: number;
};

const IDENTITIES: ReadonlyArray<RunIdentity> = [
  {
    stroke: 'var(--color-run-1)',
    chip: 'bg-run-1/12 text-run-1 ring-run-1/35',
    mutedChip: 'bg-transparent text-run-1 ring-run-1/20',
    spin: 'spin-border-run-1',
    index: 0,
  },
  {
    stroke: 'var(--color-run-2)',
    chip: 'bg-run-2/12 text-run-2 ring-run-2/35',
    mutedChip: 'bg-transparent text-run-2 ring-run-2/20',
    spin: 'spin-border-run-2',
    index: 1,
  },
  {
    stroke: 'var(--color-run-3)',
    chip: 'bg-run-3/12 text-run-3 ring-run-3/35',
    mutedChip: 'bg-transparent text-run-3 ring-run-3/20',
    spin: 'spin-border-run-3',
    index: 2,
  },
  {
    stroke: 'var(--color-run-4)',
    chip: 'bg-run-4/12 text-run-4 ring-run-4/35',
    mutedChip: 'bg-transparent text-run-4 ring-run-4/20',
    spin: 'spin-border-run-4',
    index: 3,
  },
  {
    stroke: 'var(--color-run-5)',
    chip: 'bg-run-5/12 text-run-5 ring-run-5/35',
    mutedChip: 'bg-transparent text-run-5 ring-run-5/20',
    spin: 'spin-border-run-5',
    index: 4,
  },
];

const IDENTITY_STRIDE = 2;

export const runIdentitySeed = ({ sessionId }: { readonly sessionId: string }): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < sessionId.length; index += 1) {
    hash ^= sessionId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % IDENTITIES.length;
};

export const runIdentity = ({
  laneIndex,
  seed,
}: {
  readonly laneIndex: number;
  readonly seed: number;
}): RunIdentity => {
  const identity = IDENTITIES[(seed + laneIndex * IDENTITY_STRIDE) % IDENTITIES.length];
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
