import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { currentTreeStopPort } from '../../auto/treeStopPort';
import { agentFamilyOf } from './agentFamilyOf';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { agentStateOf, isAgentOfSession } from './targets';
import { sessionIdOf, agentIdOf } from './ids';

type TreeParams = {
  readonly treeId: string;
};

const stopAutoTree = async ({ treeId }: TreeParams): Promise<HandlerResult> => {
  const port = currentTreeStopPort();
  if (port === null) {
    return failedResult({ error: 'The Lead is still starting. Try again in a moment.' });
  }
  try {
    const result = await port({ treeId });
    if (result === 'stopped') {
      return doneResult();
    }
    return failedResult({
      error:
        result === 'stuck'
          ? 'Some agents are still running. Try again.'
          : 'Another window runs this conversation. Stop it there.',
    });
  } catch (error) {
    console.error('[bridge] stopAutoTree failed', error);
    return failedResult({ error: "Couldn't stop the run." });
  }
};

export const stopAgentTree = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'stopAgentTree'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const leadId = agentIdOf({ value: action.agentId });
  const store = getStore();
  if (!isAgentOfSession({ store, sessionId, agentId: leadId })) {
    return refusedResult({ code: 'unknown-target', message: "This agent isn't on your Mac." });
  }
  const family = agentFamilyOf({ store, sessionId, leadId });
  const running = family.filter(
    (agentId) => agentStateOf({ store, sessionId, agentId }) === 'running',
  );
  const leadState = agentStateOf({ store, sessionId, agentId: leadId });
  const autoTree = (store.autoTreeViews?.[sessionId] ?? []).find(
    (view) => view.tree.rootAgentId === leadId,
  );
  if (running.length === 0 && leadState === 'stopped') {
    return doneResult();
  }
  const isPartialRetry =
    action.seenState === 'running' && leadState === 'stopped' && running.length > 0;
  if (leadState !== action.seenState && !isPartialRetry) {
    return refusedResult({
      code: 'version-changed',
      message: 'The agents changed while you looked.',
      changes: [{ label: 'Lead', was: action.seenState, now: leadState }],
    });
  }
  if (autoTree !== undefined) {
    return stopAutoTree({ treeId: autoTree.tree.id });
  }
  let stopped = 0;
  for (const agentId of running) {
    try {
      const outcome = await store.cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });
      if (outcome.outcome === 'still_running' || outcome.outcome === 'failed') {
        return failedResult({ error: `Stopped ${stopped} of ${running.length}. Try again.` });
      }
      stopped += 1;
    } catch (error) {
      console.error('[bridge] stopAgentTree failed', error);
      return failedResult({ error: `Stopped ${stopped} of ${running.length}. Try again.` });
    }
  }
  return doneResult();
};
