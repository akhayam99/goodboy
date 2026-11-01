import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestrationStop } from '@goodboy/db';
import { tauriDatabase } from '../../../../shared/lib/db';
import { workflowRunHasOpenQuestions } from '../../../../features/context/openQuestionsGate';
import {
  loadSpendLimitTelemetry,
  resolveSpendLimitStop,
  sessionBudgetBlockAfterLoad,
} from '../budgetBlock';
import { patchWorkflowRun } from '../patchWorkflowRun';
import { sessionById } from '../../sessions/sessionIndex';
import type { GetFn, SetFn } from '../types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const clearCoveredBudgetStop = async ({
  set,
  get,
  sessionId,
  workflowRunId,
}: Params): Promise<void> => {
  const run = sessionById(get().sessions, sessionId)?.workflowRuns.find(
    ({ id }) => id === workflowRunId,
  );
  if (run?.orchestrationStop?.kind !== 'budget') {
    return;
  }
  const questions = get().sessionOpenQuestions[sessionId] ?? [];
  if (!workflowRunHasOpenQuestions({ questions, run })) {
    return;
  }
  if ((await sessionBudgetBlockAfterLoad({ get, sessionId })) !== null) {
    return;
  }
  await loadSpendLimitTelemetry({ get, sessionId, runs: [run] });
  if (resolveSpendLimitStop({ get, sessionId, run })?.kind === 'pause') {
    return;
  }
  await updateWorkflowRunOrchestrationStop(tauriDatabase, workflowRunId, null);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: ({ orchestrationStop: _cleared, ...rest }) => rest,
  });
};
