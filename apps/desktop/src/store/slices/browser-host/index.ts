import type { SliceDeps } from '../../slice-types';
import { expireLoad } from './expireLoad';
import { finishLoad } from './finishLoad';
import { forgetLoad } from './forgetLoad';
import { setFavicon } from './setFavicon';
import { startLoad } from './startLoad';

export const createBrowserHostSlice = ({ set, get }: SliceDeps) => {
  return {
    startBrowserLoad: startLoad({ set, get }),
    finishBrowserLoad: finishLoad({ set, get }),
    expireBrowserLoad: expireLoad({ set, get }),
    forgetBrowserLoad: forgetLoad({ set, get }),
    setBrowserFavicon: setFavicon({ set, get }),
  };
};
