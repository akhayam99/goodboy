import type { SliceDeps } from '../../slice-types';
import { withoutLiveTab } from './withoutLiveTab';
import type { SessionTabParams } from './types';

export const unbindLiveTab = ({ set }: SliceDeps) => {
  return ({ sessionId, tabId }: SessionTabParams): void => {
    set((state) => ({
      browserLiveTabs: withoutLiveTab({ live: state.browserLiveTabs, sessionId, tabId }),
    }));
  };
};
