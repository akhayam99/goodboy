import type { Agent } from '@goodboy/types';
import { classifyAgent } from '../../../features/session/agent-kind';

type Params = {
  agents: ReadonlyArray<Agent>;
};

export const isPrReviewSession = ({ agents }: Params): boolean =>
  agents.some((agent) => classifyAgent(agent, null) === 'pr-reviewer');
