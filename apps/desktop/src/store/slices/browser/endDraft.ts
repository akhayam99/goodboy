import type { SliceDeps } from '../../slice-types';
import type { SessionParams } from './types';

export const endDraft = ({ set }: SliceDeps) => {
  return ({ sessionId }: SessionParams): void => {
    set((state) => ({
      browserDraftEnds: {
        ...state.browserDraftEnds,
        [sessionId]: (state.browserDraftEnds[sessionId] ?? 0) + 1,
      },
    }));
  };
};
