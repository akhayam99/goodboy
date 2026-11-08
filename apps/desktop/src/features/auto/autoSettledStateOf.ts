import type { AutoOutcome } from '@goodboy/db';
import type { AutoChildState } from './autoGroupOf';

type Params = {
  readonly outcome: AutoOutcome | null;
  readonly isReplaced: boolean;
};

export const autoSettledStateOf = ({ outcome, isReplaced }: Params): AutoChildState => {
  switch (outcome) {
    case 'completed':
      return 'done';
    case 'timed_out':
      return 'timedOut';
    case 'blocked':
      return isReplaced ? 'done' : 'returned';
    case 'stopped':
      return 'stopped';
    case 'failed':
    case null:
      return 'failed';
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
};
