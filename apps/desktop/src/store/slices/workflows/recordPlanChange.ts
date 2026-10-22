import type { AgentId, PlanChangeRequest, SessionId, WorkflowRunId } from '@goodboy/types';
import { rulesWithoutAsk } from './rulesWithoutAsk';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly change: PlanChangeRequest;
  readonly agentId: AgentId | null;
};

export const recordPlanChange = async ({
  get,
  sessionId,
  workflowRunId,
  change,
  agentId,
}: Params): Promise<void> => {
  await get().updateWorkflowRunRules(sessionId, workflowRunId, (rules) => ({
    ...rulesWithoutAsk({ rules }),
    planChanges: [
      ...(rules.planChanges ?? []),
      { ...change, agentId: change.kind === 'skipped' ? null : agentId },
    ],
  }));
};
