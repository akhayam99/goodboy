import type { DotState } from '@goodboy/ui';
import type { AutoTreeState } from './autoTreeWordOf';

type Params = {
  readonly state: AutoTreeState;
};

export const autoDotOf = ({ state }: Params): DotState => {
  switch (state) {
    case 'asking':
    case 'paused':
      return 'needsYou';
    case 'failed':
      return 'failed';
    case 'running':
    case 'stopping':
      return 'running';
    case 'done':
      return 'done';
    case 'stopped':
      return 'stopped';
    case 'idle':
      return 'idle';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
