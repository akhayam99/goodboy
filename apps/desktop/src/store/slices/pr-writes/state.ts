import type { PrWriteClaim } from './types';

export const PR_WRITE_CLAIM_TTL_MS = 120_000;

export type PrWritesState = {
  readonly prWriteClaims: Readonly<Record<string, PrWriteClaim>>;
};

export const prWritesInitialState: PrWritesState = {
  prWriteClaims: {},
};
