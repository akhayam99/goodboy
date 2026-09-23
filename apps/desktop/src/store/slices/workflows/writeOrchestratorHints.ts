import type { OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestratorHints } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly hints: ReadonlyArray<OrchestratorHint>;
};

export const writeOrchestratorHints = async ({
  set,
  sessionId,
  workflowRunId,
  hints,
}: Params): Promise<void> => {
  await updateWorkflowRunOrchestratorHints(tauriDatabase, workflowRunId, hints);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (current) =>
      hints.length === 0
        ? withoutKeys(current, ['orchestratorHints'])
        : { ...current, orchestratorHints: hints },
  });
};
