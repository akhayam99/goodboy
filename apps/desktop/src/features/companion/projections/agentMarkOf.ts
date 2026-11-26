import type { AgentState } from '../contract/projections';
import type { StatusMark } from '../contract/vocabulary';

type Params = {
  readonly state: AgentState;
};

export const agentMarkOf = ({ state }: Params): StatusMark => {
  if (state === 'waiting') {
    return { kind: 'state', state: 'question' };
  }
  return { kind: 'state', state };
};
