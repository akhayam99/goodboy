import type { SessionId, WorkflowRunId } from '@goodboy/types';
import {
  updateWorkflowRunOrchestrationOutcome,
  updateWorkflowRunOrchestrationStop,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const clearOrchestrationOutcome = async ({
  set,
  sessionId,
  workflowRunId,
}: Params): Promise<void> => {
  await updateWorkflowRunOrchestrationOutcome(tauriDatabase, workflowRunId, null);
  await updateWorkflowRunOrchestrationStop(tauriDatabase, workflowRunId, null);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (current) =>
      withoutKeys(current, ['orchestrationOutcome', 'orchestrationReason', 'orchestrationStop']),
  });
};
