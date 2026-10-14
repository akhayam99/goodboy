import type { Agent, WorkflowRun } from '@goodboy/types';
import { hasActiveWorkflowRun } from '../workflows/activeWorkflowRuns';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflowRuns: ReadonlyArray<WorkflowRun>;
  readonly openQuestionCount: number;
};

const SETTLED_AGENT_STATUSES: ReadonlySet<Agent['status']> = new Set([
  'completed',
  'skipped',
  'stopped',
]);

export const isSessionIdle = ({ agents, workflowRuns, openQuestionCount }: Params): boolean => {
  if (openQuestionCount > 0) {
    return false;
  }
  if (!agents.every((agent) => SETTLED_AGENT_STATUSES.has(agent.status))) {
    return false;
  }
  return !hasActiveWorkflowRun({ workflowRuns, agents });
};
