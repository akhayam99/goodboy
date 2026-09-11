import { PR_WRITE_CLAIM_TTL_MS } from './state';
import type { PrWriteClaim } from './types';

export const liveClaim = ({
  claim,
  now,
}: {
  readonly claim: PrWriteClaim | undefined;
  readonly now: number;
}): PrWriteClaim | null => {
  if (claim === undefined) {
    return null;
  }
  if (now - claim.startedAt >= PR_WRITE_CLAIM_TTL_MS) {
    return null;
  }
  return claim;
};
