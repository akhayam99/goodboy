import { formatCandidatesBlock } from '@goodboy/core/providers';
import { ROLE_REGISTRY, SELECTABLE_AGENT_ROLES } from '@goodboy/core/roles';
import type { SessionId, WorkflowRun } from '@goodboy/types';
import type { GetFn } from '../workflows/types';
import { stepCandidateInputs } from './stepCandidateInputs';

const STEP_ROLES = SELECTABLE_AGENT_ROLES.filter((role) => ROLE_REGISTRY[role].workflowEligible);

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const orchestratorCandidatesBlock = async ({
  get,
  sessionId,
  run,
}: Params): Promise<string | null> => {
  if (run.rulesSnapshot?.canOrchestratorPickModel !== true) {
    return null;
  }
  const inputs = await stepCandidateInputs({
    get,
    sessionId,
    runProviders: run.providerPool,
    rules: run.rulesSnapshot,
  });
  return formatCandidatesBlock({ inputs, roles: STEP_ROLES, scope: 'step' });
};
