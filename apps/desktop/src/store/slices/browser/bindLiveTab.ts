import type { SliceDeps } from '../../slice-types';
import type { LiveTabParams } from './types';

export const bindLiveTab = ({ set }: SliceDeps) => {
  return ({ sessionId, tabId, liveId }: LiveTabParams): void => {
    set((state) => ({
      browserLiveTabs: {
        ...state.browserLiveTabs,
        [sessionId]: { ...state.browserLiveTabs[sessionId], [tabId]: liveId },
      },
    }));
  };
};
