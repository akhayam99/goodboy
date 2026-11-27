import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import { readCompanionPhones } from './readCompanionPhones';
import { refreshCompanionLink } from './refreshCompanionLink';
import { setCompanionPageOpen } from './setCompanionPageOpen';

export const createCompanionLinkSlice = ({ set, get }: SliceDeps) => {
  const latest = createLatestOnly();
  return {
    refreshCompanionLink: refreshCompanionLink({ set, get, latest }),
    readCompanionPhones: readCompanionPhones({ set, get, latest }),
    setCompanionPageOpen: setCompanionPageOpen({ set, get }),
  };
};
