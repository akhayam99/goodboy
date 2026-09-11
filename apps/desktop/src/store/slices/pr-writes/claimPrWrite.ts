import { announcePrWrite } from '../../../features/review/prWriteBus';
import { currentWindowLabel } from '../../../features/workspace/window';
import { liveClaim } from './liveClaim';
import { prWriteKey } from './prWriteKey';
import type { ClaimPrWriteParams, GetFn, PrWriteClaimResult, SetFn } from './types';

let nextSequence = 0;

const freshToken = ({
  windowLabel,
  now,
}: {
  readonly windowLabel: string;
  readonly now: number;
}): string => {
  nextSequence += 1;
  return `${windowLabel}-${now}-${nextSequence}`;
};

export const claimPrWrite = (set: SetFn, get: GetFn) => {
  return ({ projectId, prNumber, action }: ClaimPrWriteParams): PrWriteClaimResult => {
    const key = prWriteKey({ projectId, prNumber });
    const now = Date.now();
    const held = liveClaim({ claim: get().prWriteClaims[key], now });
    if (held !== null) {
      return { ok: false, claim: held };
    }
    const windowLabel = currentWindowLabel();
    const claim = {
      key,
      token: freshToken({ windowLabel, now }),
      windowLabel,
      action,
      startedAt: now,
    };
    set((state) => ({ prWriteClaims: { ...state.prWriteClaims, [key]: claim } }));
    void announcePrWrite({ kind: 'claimed', ...claim });
    return { ok: true, token: claim.token };
  };
};
