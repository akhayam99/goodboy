export type RunIdentity = {
  readonly stroke: string;
  readonly chip: string;
  readonly mutedChip: string;
  readonly spin: string;
  readonly index: number;
};

const IDENTITIES: ReadonlyArray<RunIdentity> = [
  {
    stroke: 'var(--color-identity-1)',
    chip: 'bg-identity-1/12 text-identity-1 ring-identity-1/35',
    mutedChip: 'bg-transparent text-identity-1 ring-identity-1/20',
    spin: 'spin-border-identity-1',
    index: 0,
  },
  {
    stroke: 'var(--color-identity-2)',
    chip: 'bg-identity-2/12 text-identity-2 ring-identity-2/35',
    mutedChip: 'bg-transparent text-identity-2 ring-identity-2/20',
    spin: 'spin-border-identity-2',
    index: 1,
  },
  {
    stroke: 'var(--color-identity-3)',
    chip: 'bg-identity-3/12 text-identity-3 ring-identity-3/35',
    mutedChip: 'bg-transparent text-identity-3 ring-identity-3/20',
    spin: 'spin-border-identity-3',
    index: 2,
  },
  {
    stroke: 'var(--color-identity-4)',
    chip: 'bg-identity-4/12 text-identity-4 ring-identity-4/35',
    mutedChip: 'bg-transparent text-identity-4 ring-identity-4/20',
    spin: 'spin-border-identity-4',
    index: 3,
  },
  {
    stroke: 'var(--color-identity-5)',
    chip: 'bg-identity-5/12 text-identity-5 ring-identity-5/35',
    mutedChip: 'bg-transparent text-identity-5 ring-identity-5/20',
    spin: 'spin-border-identity-5',
    index: 4,
  },
  {
    stroke: 'var(--color-identity-6)',
    chip: 'bg-identity-6/12 text-identity-6 ring-identity-6/35',
    mutedChip: 'bg-transparent text-identity-6 ring-identity-6/20',
    spin: 'spin-border-identity-6',
    index: 5,
  },
  {
    stroke: 'var(--color-identity-7)',
    chip: 'bg-identity-7/12 text-identity-7 ring-identity-7/35',
    mutedChip: 'bg-transparent text-identity-7 ring-identity-7/20',
    spin: 'spin-border-identity-7',
    index: 6,
  },
  {
    stroke: 'var(--color-identity-8)',
    chip: 'bg-identity-8/12 text-identity-8 ring-identity-8/35',
    mutedChip: 'bg-transparent text-identity-8 ring-identity-8/20',
    spin: 'spin-border-identity-8',
    index: 7,
  },
];

const IDENTITY_STRIDE = 3;

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
