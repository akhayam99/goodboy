import { runsForWorkflowRun } from '@goodboy/core/workflows';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { cancelRunningSteps } from './cancelRunningSteps';
import { requestDecisionRestart } from './decisionRestart';
import { readHolding } from './readHolding';
import type { GetFn, SetFn } from './types';

type DeliverParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

type Params = DeliverParams & {
  readonly hintIds: ReadonlyArray<string>;
};

const deliverNow = async ({ set, get, sessionId, workflowRunId }: DeliverParams): Promise<void> => {
  if (get().orchestratingWorkflowRuns[workflowRunId] === true) {
    requestDecisionRestart({ set, workflowRunId });
    await get().orchestrateNextStep(sessionId, workflowRunId);
    return;
  }
  const hasRunningStep = runsForWorkflowRun(
    get().sessionPhaseRuns[sessionId] ?? [],
    workflowRunId,
  ).some((agent) => agent.status === 'running');
  if (hasRunningStep) {
    const { stillRunning } = await cancelRunningSteps({
      set,
      get,
      sessionId,
      workflowRunId,
      cut: 'skipped',
    });
    if (stillRunning.length > 0) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "The step didn't stop",
        body: 'It is still running, so your hint waits in the queue. Try again in a moment.',
        sessionId,
      });
      return;
    }
  }
  await get().continueWorkflowRun(sessionId, workflowRunId);
};

export const readNow = ({ set, get, sessionId, workflowRunId, hintIds }: Params) =>
  readHolding({
    set,
    get,
    sessionId,
    workflowRunId,
    hintIds,
    run: () => deliverNow({ set, get, sessionId, workflowRunId }),
  });
