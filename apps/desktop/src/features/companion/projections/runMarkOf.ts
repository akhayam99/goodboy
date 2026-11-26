import type { RunState } from '../contract/projections';
import type { StatusMark } from '../contract/vocabulary';

type Params = {
  readonly state: RunState;
};

export const runMarkOf = ({ state }: Params): StatusMark => {
  if (state === 'paused') {
    return { kind: 'state', state: 'budget' };
  }
  if (state === 'waiting') {
    return { kind: 'state', state: 'question' };
  }
  return { kind: 'state', state };
};
