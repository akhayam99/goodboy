import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { runStateOf, sessionOfAction, workflowRunOf } from './targets';

export const stopRun = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'stopRun'>>): Promise<HandlerResult> => {
  const sessionId = action.sessionId as SessionId;
  const store = getStore();
  const session = sessionOfAction({
    store,
    workspaceId: action.workspaceId,
    sessionId: action.sessionId,
  });
  const run = session === null ? null : workflowRunOf({ session, runId: action.runId });
  if (run === null) {
    return refusedResult({ code: 'unknown-target', message: 'This run is not on your Mac.' });
  }
  const state = runStateOf({ store, sessionId, run });
  if (state === 'stopped') {
    return doneResult();
  }
  if (state !== action.seenState) {
    return refusedResult({
      code: 'version-changed',
      message: 'The run changed while you looked.',
      changes: [{ label: 'Run', was: action.seenState, now: state }],
    });
  }
  const outcome = await store.closeWorkflowRun(sessionId, run.id as WorkflowRunId);
  return outcome === 'closed'
    ? doneResult()
    : failedResult({ error: 'A step did not stop. Press Stop run again.' });
};
