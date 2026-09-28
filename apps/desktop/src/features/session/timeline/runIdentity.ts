export type RunIdentity = {
  readonly stroke: string;
  readonly spin: string;
  readonly index: number;
};

const IDENTITIES: ReadonlyArray<RunIdentity> = [
  { stroke: 'var(--color-identity-1)', spin: 'spin-border-identity-1', index: 0 },
  { stroke: 'var(--color-identity-2)', spin: 'spin-border-identity-2', index: 1 },
  { stroke: 'var(--color-identity-3)', spin: 'spin-border-identity-3', index: 2 },
  { stroke: 'var(--color-identity-4)', spin: 'spin-border-identity-4', index: 3 },
  { stroke: 'var(--color-identity-5)', spin: 'spin-border-identity-5', index: 4 },
  { stroke: 'var(--color-identity-6)', spin: 'spin-border-identity-6', index: 5 },
  { stroke: 'var(--color-identity-7)', spin: 'spin-border-identity-7', index: 6 },
  { stroke: 'var(--color-identity-8)', spin: 'spin-border-identity-8', index: 7 },
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
