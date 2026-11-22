import type { Agent } from '@goodboy/types';
import { agentThreadIds } from '../session/agentThreadIds';
import { canHoldThreads } from '../work/sendToLead/canHoldThreads';

type Params = {
  readonly agent: Agent;
};

export const holdsCommentThreads = ({ agent }: Params): boolean =>
  canHoldThreads({ agent }) &&
  (agent.sourceKind === 'comment_run' || agentThreadIds(agent).length > 0);
