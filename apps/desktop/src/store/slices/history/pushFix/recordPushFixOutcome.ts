import { persistPushFixes } from './persistPushFixes';
import type { SliceDeps } from '../../../slice-types';
import type { PushFixFollowUp, PushFixOutcome } from '../types';

type RecordParams = SliceDeps & {
  readonly outcome: PushFixOutcome;
};

export const recordPushFixOutcome = ({ set, get, outcome }: RecordParams): void => {
  set((state) => ({
    pushFixOutcomes: { ...state.pushFixOutcomes, [outcome.mountId]: outcome },
  }));
  persistPushFixes({ get });
};

type FollowUpParams = SliceDeps & {
  readonly mountId: PushFixOutcome['mountId'];
  readonly agentId: PushFixOutcome['agentId'];
  readonly followUp: PushFixFollowUp;
};

export const recordPushFixFollowUp = ({
  set,
  get,
  mountId,
  agentId,
  followUp,
}: FollowUpParams): void => {
  const outcome = get().pushFixOutcomes[mountId];
  if (outcome === undefined || outcome.agentId !== agentId) {
    return;
  }
  recordPushFixOutcome({ set, get, outcome: { ...outcome, followUp } });
};
