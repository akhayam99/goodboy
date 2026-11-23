import type { Agent } from '@goodboy/types';
import { isLeadRoot } from './isLeadRoot';

type Params = {
  readonly agent: Pick<Agent, 'kind' | 'parentAgentId' | 'sourceKind'>;
};

export const canHoldThreads = ({ agent }: Params): boolean =>
  agent.sourceKind === 'comment_run' || (isLeadRoot({ agent }) && agent.sourceKind == null);
