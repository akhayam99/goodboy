import { persistPushFixes } from './persistPushFixes';
import type { SliceDeps } from '../../../slice-types';
import type { PushFixOutcome } from '../types';

type RecordParams = SliceDeps & {
  readonly outcome: PushFixOutcome;
  readonly isHeld?: boolean;
};

export const recordPushFixOutcome = ({ set, get, outcome, isHeld = false }: RecordParams): void => {
  set((state) => ({
    pushFixOutcomes: { ...state.pushFixOutcomes, [outcome.mountId]: outcome },
    ...(isHeld && {
      pushFixClaims: { ...state.pushFixClaims, [outcome.mountId]: outcome.agentId },
    }),
  }));
  persistPushFixes({ get });
};
