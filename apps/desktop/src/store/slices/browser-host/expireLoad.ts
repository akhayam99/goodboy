import type { SliceDeps } from '../../slice-types';
import type { ExpireLoadParams } from './types';
import { withoutLoad } from './withoutLoad';

export const expireLoad = ({ set, get }: SliceDeps) => {
  return ({ tabId, startedAt }: ExpireLoadParams): boolean => {
    const load = get().browserLoads[tabId];
    if (load === undefined || load.startedAt !== startedAt) {
      return false;
    }
    set((state) => ({ browserLoads: withoutLoad({ loads: state.browserLoads, tabId }) }));
    return true;
  };
};
