import { closeSessionsCard } from './closeSessionsCard';
import { hydrateSessionsCard } from './hydrateSessionsCard';
import type { SliceDeps } from '../../slice-types';

export const createSessionsCardSlice = ({ set, get }: SliceDeps) => {
  return {
    hydrateSessionsCard: hydrateSessionsCard({ set, get }),
    closeSessionsCard: closeSessionsCard({ set, get }),
  };
};
