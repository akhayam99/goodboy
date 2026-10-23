import type { AutoChildState } from './autoGroupOf';

type Params = {
  readonly state: AutoChildState;
  readonly hasAgent: boolean;
};

export const isAutoChildGone = ({ state, hasAgent }: Params): boolean =>
  !hasAgent && state !== 'neverStarted' && state !== 'queued';
