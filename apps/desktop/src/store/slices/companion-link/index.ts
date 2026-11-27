import type { SliceDeps } from '../../slice-types';
import { readCompanionPhones } from './readCompanionPhones';
import { refreshCompanionLink } from './refreshCompanionLink';
import { setCompanionPageOpen } from './setCompanionPageOpen';

export const createCompanionLinkSlice = ({ set, get }: SliceDeps) => {
  return {
    refreshCompanionLink: refreshCompanionLink({ set, get }),
    readCompanionPhones: readCompanionPhones({ set, get }),
    setCompanionPageOpen: setCompanionPageOpen({ set, get }),
  };
};
