import type { OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestratorHints } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import { findWorkflowRun } from './findWorkflowRun';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly update: (hints: ReadonlyArray<OrchestratorHint>) => ReadonlyArray<OrchestratorHint>;
};

const writes = createKeyedQueue();

const applyUpdate = async ({ set, get, sessionId, workflowRunId, update }: Params) => {
  const current = findWorkflowRun({ get, sessionId, workflowRunId })?.orchestratorHints ?? [];
  const hints = update(current);
  if (hints === current) {
    return;
  }
  await updateWorkflowRunOrchestratorHints(tauriDatabase, workflowRunId, hints);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (run) =>
      hints.length === 0
        ? withoutKeys(run, ['orchestratorHints'])
        : { ...run, orchestratorHints: hints },
  });
};

export const updateOrchestratorHints = (params: Params): Promise<void> => {
  return writes.run({
    key: params.workflowRunId,
    task: () => applyUpdate(params),
  });
};
