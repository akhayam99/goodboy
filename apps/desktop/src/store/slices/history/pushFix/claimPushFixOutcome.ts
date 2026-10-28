import { persistPushFixes } from './persistPushFixes';
import type { SliceDeps } from '../../../slice-types';
import type { PushFixOutcome } from '../types';

type Params = {
  readonly mountId: PushFixOutcome['mountId'];
  readonly agentId: PushFixOutcome['agentId'];
};

export const claimPushFixOutcome = ({ set, get }: SliceDeps) => {
  return ({ mountId, agentId }: Params): boolean => {
    const outcome = get().pushFixOutcomes[mountId];
    if (outcome === undefined || outcome.agentId !== agentId || outcome.isClaimed) {
      return false;
    }
    set((state) => ({
      pushFixOutcomes: { ...state.pushFixOutcomes, [mountId]: { ...outcome, isClaimed: true } },
    }));
    persistPushFixes({ get });
    return true;
  };
};
