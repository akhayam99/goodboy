import type { SliceDeps } from '../../slice-types';
import type { SessionParams } from './types';

export const forgetClosedTab = ({ set }: SliceDeps) => {
  return ({ sessionId }: SessionParams): void => {
    set((state) => ({
      browserClosedTabs: {
        ...state.browserClosedTabs,
        [sessionId]: (state.browserClosedTabs[sessionId] ?? []).slice(1),
      },
    }));
  };
};
