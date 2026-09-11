import { announcePrWrite } from '../../../features/review/prWriteBus';
import { prWriteKey } from './prWriteKey';
import type { GetFn, ReleasePrWriteParams, SetFn } from './types';

export const releasePrWrite = (set: SetFn, get: GetFn) => {
  return ({ projectId, prNumber, token }: ReleasePrWriteParams): void => {
    const key = prWriteKey({ projectId, prNumber });
    const claim = get().prWriteClaims[key];
    if (claim === undefined || claim.token !== token) {
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
