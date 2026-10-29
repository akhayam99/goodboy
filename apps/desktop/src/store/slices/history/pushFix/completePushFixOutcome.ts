import { claimsWithout } from './claimsWithout';
import { persistPushFixes } from './persistPushFixes';
import type { SliceDeps } from '../../../slice-types';
import type { PushFixFollowUp, PushFixOutcome } from '../types';

type Params = {
  readonly mountId: PushFixOutcome['mountId'];
  readonly agentId: PushFixOutcome['agentId'];
  readonly followUp: PushFixFollowUp | null;
};

export const completePushFixOutcome = ({ set, get }: SliceDeps) => {
  return ({ mountId, agentId, followUp }: Params): void => {
    set((state) => {
      const pushFixClaims = claimsWithout({ claims: state.pushFixClaims, mountId, agentId });
      const outcome = state.pushFixOutcomes[mountId];
      if (outcome === undefined || outcome.agentId !== agentId) {
        return { pushFixClaims };
      }
      return {
        pushFixClaims,
        pushFixOutcomes: {
          ...state.pushFixOutcomes,
          [mountId]: { ...outcome, isClaimed: true, followUp: followUp ?? outcome.followUp },
        },
      };
    });
    persistPushFixes({ get });
  };
};
