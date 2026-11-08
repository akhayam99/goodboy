import type { AutoChildState } from './autoGroupOf';

export type AutoStuckKind = 'neverStarted' | 'failed' | 'timedOut';

type Params = {
  readonly state: AutoChildState;
};

export const autoStuckKindOf = ({ state }: Params): AutoStuckKind | null => {
  switch (state) {
    case 'neverStarted':
    case 'failed':
    case 'timedOut':
      return state;
    case 'returned':
    case 'running':
    case 'done':
    case 'stopped':
    case 'retried':
    case 'queued':
      return null;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
