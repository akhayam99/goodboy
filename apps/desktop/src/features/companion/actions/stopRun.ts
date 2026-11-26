import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { runStateOf, sessionOfAction, workflowRunOf } from './targets';
import { sessionIdOf } from './ids';

export const stopRun = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'stopRun'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const store = getStore();
  const session = sessionOfAction({
    store,
    workspaceId: action.workspaceId,
    sessionId: action.sessionId,
  });
  const run = session === null ? null : workflowRunOf({ session, runId: action.runId });
  if (run === null) {
    return refusedResult({ code: 'unknown-target', message: "This run isn't on your Mac." });
  }
  const state = runStateOf({ store, sessionId, run });
  if (state === 'stopped' || run.orchestrationStop?.kind === 'operator') {
    return doneResult();
  }
  if (state !== action.seenState) {
    return refusedResult({
      code: 'version-changed',
      message: 'The run changed while you looked.',
      changes: [{ label: 'Run', was: action.seenState, now: state }],
    });
  }
  try {
    const outcome = await store.stopWorkflowRunNow(sessionId, run.id);
    return outcome === 'stopped'
      ? doneResult()
      : failedResult({ error: 'A step did not stop. Press Stop run again.' });
  } catch (error) {
    console.error('[bridge] stopRun failed', error);
    return failedResult({ error: "Couldn't stop the run." });
  }
};
