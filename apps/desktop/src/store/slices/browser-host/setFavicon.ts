import type { SliceDeps } from '../../slice-types';
import type { SetFaviconParams } from './types';

export const setFavicon = ({ set }: SliceDeps) => {
  return ({ origin, src }: SetFaviconParams): void => {
    set((state) => ({ browserFavicons: { ...state.browserFavicons, [origin]: src } }));
  };
};
