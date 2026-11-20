import type { LeadStopState } from '@goodboy/core/auto';
import { NAMES } from '../../shared/utils/names';

type Params = {
  readonly lead: LeadStopState;
};

export const leadStopWordOf = ({ lead }: Params): string => {
  switch (lead.stop) {
    case 'working':
      return NAMES.running;
    case 'waitsForYou':
      return lead.reason === 'planReady' ? NAMES.needsApproval : NAMES.needsYou;
    case 'resting':
      return NAMES.idle;
    case 'stopped':
      return NAMES.stopped;
    case 'finished':
      return NAMES.done;
    default: {
      const exhaustive: never = lead.stop;
      return exhaustive;
    }
  }
};
