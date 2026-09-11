import { announcePrWrite } from '../../../features/review/prWriteBus';
import { currentWindowLabel } from '../../../features/workspace/window';
import { prWriteKey } from './prWriteKey';
import type { GetFn, PrWriteTarget, SetFn } from './types';

export const releasePrWrite = (set: SetFn, get: GetFn) => {
  return ({ projectId, prNumber }: PrWriteTarget): void => {
    const key = prWriteKey({ projectId, prNumber });
    const claim = get().prWriteClaims[key];
    if (claim === undefined || claim.windowLabel !== currentWindowLabel()) {
      return;
    }
    set((state) => {
      const next = { ...state.prWriteClaims };
      delete next[key];
      return { prWriteClaims: next };
    });
    void announcePrWrite({ kind: 'released', ...claim });
  };
};
