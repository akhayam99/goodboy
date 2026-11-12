import type { SliceDeps } from '../../slice-types';
import type { StartLoadParams } from './types';

export const startLoad = ({ set }: SliceDeps) => {
  return ({ tabId, url, startedAt }: StartLoadParams): void => {
    set((state) => ({
      browserLoads: { ...state.browserLoads, [tabId]: { url, startedAt } },
    }));
  };
};
