import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { runStateOf, sessionOfAction, workflowRunOf } from './targets';
import { sessionIdOf } from './ids';

export const continueRun = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'continueRun'>>): Promise<HandlerResult> => {
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
  if (state === 'running') {
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
    await store.continueWorkflowRun(sessionId, run.id);
  } catch (error) {
    console.error('[bridge] continueRun failed', error);
    return failedResult({ error: "Couldn't continue the run." });
  }
  return doneResult();
};
