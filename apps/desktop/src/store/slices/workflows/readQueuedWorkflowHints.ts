import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { findWorkflowRun } from './findWorkflowRun';
import { isRunIdleForHints } from './isRunIdleForHints';
import { readHolding } from './readHolding';
import { readNow } from './readNow';
import { unreadHintIdsOf } from './unreadHintIdsOf';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const readQueuedWorkflowHints = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, workflowRunId }: Params): Promise<void> => {
    const target = { get, sessionId, workflowRunId };
    const hintIds = unreadHintIdsOf(target);
    if (hintIds.length === 0) {
      return;
    }
    const run = findWorkflowRun(target);
    if (run?.orchestrationStop?.kind === 'operator') {
      await readHolding({
        set,
        get,
        sessionId,
        workflowRunId,
        hintIds,
        run: () => get().retryWorkflowOrchestration(sessionId, workflowRunId),
      });
      return;
    }
    if (isRunIdleForHints(target) === false) {
      return;
    }
    await readNow({ set, ...target, hintIds });
  };
};
