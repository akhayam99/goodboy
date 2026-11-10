import type { SliceDeps } from '../../slice-types';
import type { FinishLoadParams } from './types';
import { withoutLoad } from './withoutLoad';

export const finishLoad = ({ set, get }: SliceDeps) => {
  return ({ tabId, url }: FinishLoadParams): boolean => {
    const load = get().browserLoads[tabId];
    if (load === undefined || load.url !== url) {
      return false;
    }
    set((state) => ({ browserLoads: withoutLoad({ loads: state.browserLoads, tabId }) }));
    return true;
  };
};
