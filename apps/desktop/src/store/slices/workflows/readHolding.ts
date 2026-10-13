import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { markHintsReading, releaseHintsReading } from './orchestratorReadingHints';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly hintIds: ReadonlyArray<string>;
  readonly run: () => Promise<void>;
};

export const readHolding = async ({ set, get, workflowRunId, hintIds, run }: Params) => {
  markHintsReading({ set, workflowRunId, hintIds });
  try {
    await run();
  } finally {
    const isDecisionAhead =
      get().orchestratingWorkflowRuns[workflowRunId] === true ||
      get().pendingOrchestrations[workflowRunId] != null;
    if (isDecisionAhead === false) {
      releaseHintsReading({ set, workflowRunId, hintIds });
    }
  }
};
