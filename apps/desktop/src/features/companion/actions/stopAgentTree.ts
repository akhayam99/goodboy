import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { agentFamilyOf } from './agentFamilyOf';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { agentStateOf, isAgentOfSession } from './targets';
import { sessionIdOf, agentIdOf } from './ids';

export const stopAgentTree = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'stopAgentTree'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const leadId = agentIdOf({ value: action.agentId });
  const store = getStore();
  if (!isAgentOfSession({ store, sessionId, agentId: leadId })) {
    return refusedResult({ code: 'unknown-target', message: 'This agent is not on your Mac.' });
  }
  const family = agentFamilyOf({ store, sessionId, leadId });
  const running = family.filter(
    (agentId) => agentStateOf({ store, sessionId, agentId }) === 'running',
  );
  const leadState = agentStateOf({ store, sessionId, agentId: leadId });
  if (running.length === 0 && leadState === 'stopped') {
    return doneResult();
  }
  if (leadState !== action.seenState) {
    return refusedResult({
      code: 'version-changed',
      message: 'The agents changed while you looked.',
      changes: [{ label: 'Lead', was: action.seenState, now: leadState }],
    });
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
