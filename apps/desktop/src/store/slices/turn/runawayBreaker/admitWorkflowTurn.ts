import type { AgentId, SessionId } from '@goodboy/types';
import { sessionBudgetBlockAfterLoad } from '../../workflows/budgetBlock';
import { persistOrchestrationStop } from '../../workflows/orchestrateNextStep';
import { admitRunBudget } from '../../workflows/runState/admitRunBudget';
import { claimWorkflowTurn } from '../workflowTurnBreaker';
import type { GetFn, SetFn } from '../types';
import { readAgentRunLimit } from './readAgentRunLimit';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export type WorkflowTurnAdmission = 'admitted' | 'tripped' | 'overLimit';

export const admitWorkflowTurn = async ({
  set,
  get,
  sessionId,
  agentId,
}: Params): Promise<WorkflowTurnAdmission> => {
  const { isLimited, run } = await readAgentRunLimit({ get, sessionId, agentId });
  if (!isLimited) {
    return claimWorkflowTurn({ agentId, nowMs: Date.now() }) === 'tripped' ? 'tripped' : 'admitted';
  }
  if (run === null) {
    const sessionBlock = await sessionBudgetBlockAfterLoad({ get, sessionId });
    return sessionBlock === null ? 'admitted' : 'overLimit';
  }
  const admission = await admitRunBudget({ set, get, sessionId, run });
  if (admission.kind === 'admitted') {
    return 'admitted';
  }
  await persistOrchestrationStop({ set, sessionId, workflowRunId: run.id, stop: admission.stop });
  return 'overLimit';
};
