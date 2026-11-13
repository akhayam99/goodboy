import type { SliceDeps } from '../../slice-types';
import type { ForgetLoadParams } from './types';
import { withoutLoad } from './withoutLoad';

export const forgetLoad = ({ set, get }: SliceDeps) => {
  return ({ tabId }: ForgetLoadParams): void => {
    if (get().browserLoads[tabId] === undefined) {
      return;
    }
    set((state) => ({ browserLoads: withoutLoad({ loads: state.browserLoads, tabId }) }));
  };
};
