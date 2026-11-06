import type { Agent, SessionId, WorkflowRunId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { cancelRunningSteps } from './cancelRunningSteps';
import { persistOrchestrationStop } from './orchestrateNextStep';
import { stoppedAutoRuns } from './stoppedAutoRuns';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

const OPERATOR_STOP_MESSAGE =
  'You stopped this run. What the step wrote is kept, and Continue picks it up.';

export type StopWorkflowRunOutcome = 'stopped' | 'still_running' | 'failed';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

type NamesParams = Readonly<{
  agents: ReadonlyArray<Agent>;
}>;

const stillRunningTitle = ({ agents }: NamesParams): string =>
  agents.length === 1 ? `${agents[0]?.name ?? 'The step'} did not stop` : 'Some steps did not stop';

const runStop = async ({
  set,
  get,
  sessionId,
  workflowRunId,
}: Params): Promise<StopWorkflowRunOutcome> => {
  const session = sessionById(get().sessions, sessionId);
  const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
  if (run == null || run.discardedAt != null) {
    return 'stopped';
  }
  const previousStop = run.orchestrationStop ?? null;
  const wasAutoRun = run.autoRun;
  await persistOrchestrationStop({
    set,
    sessionId,
    workflowRunId,
    stop: { kind: 'operator', message: OPERATOR_STOP_MESSAGE },
  });
  await get().setWorkflowRunAutoRun(sessionId, workflowRunId, false);
  const { stillRunning } = await cancelRunningSteps({
    set,
    get,
    sessionId,
    workflowRunId,
    cut: 'stopped',
  });
  if (stillRunning.length === 0) {
    if (wasAutoRun) {
      stoppedAutoRuns.remember({ workflowRunId });
    }
    return 'stopped';
  }
  await persistOrchestrationStop({ set, sessionId, workflowRunId, stop: previousStop });
  if (wasAutoRun) {
    await get().setWorkflowRunAutoRun(sessionId, workflowRunId, true);
  }
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: stillRunningTitle({ agents: stillRunning }),
    body: 'It is still running. Press Stop again to retry.',
    sessionId,
  });
  return 'still_running';
};

export const stopWorkflowRunNow = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
  ): Promise<StopWorkflowRunOutcome> => {
    try {
      return await runStop({ set, get, sessionId, workflowRunId });
    } catch (error) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "The run didn't fully stop",
        body: formatError(error),
        sessionId,
      });
      return 'failed';
    }
  };
};
