import { announcePrWrite } from '../../../features/review/prWriteBus';
import { currentWindowLabel } from '../../../features/workspace/window';
import { liveClaim } from './liveClaim';
import { prWriteKey } from './prWriteKey';
import type { ClaimPrWriteParams, GetFn, PrWriteClaimResult, SetFn } from './types';

export const claimPrWrite = (set: SetFn, get: GetFn) => {
  return ({ projectId, prNumber, action }: ClaimPrWriteParams): PrWriteClaimResult => {
    const key = prWriteKey({ projectId, prNumber });
    const now = Date.now();
    const held = liveClaim({ claim: get().prWriteClaims[key], now });
    if (held !== null) {
      return { ok: false, claim: held };
    }
    const claim = { key, windowLabel: currentWindowLabel(), action, startedAt: now };
    set((state) => ({ prWriteClaims: { ...state.prWriteClaims, [key]: claim } }));
    void announcePrWrite({ kind: 'claimed', ...claim });
    return { ok: true };
  };
};
