import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { agentStateOf, isAgentOfSession } from './targets';
import { sessionIdOf, agentIdOf } from './ids';

export const stopAgent = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'stopAgent'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const agentId = agentIdOf({ value: action.agentId });
  const store = getStore();
  if (!isAgentOfSession({ store, sessionId, agentId })) {
    return refusedResult({ code: 'unknown-target', message: "This agent isn't on your Mac." });
  }
  const state = agentStateOf({ store, sessionId, agentId });
  if (state === 'stopped') {
    return doneResult();
  }
  if (state !== action.seenState) {
    return refusedResult({
      code: 'version-changed',
      message: 'The agent changed while you looked.',
      changes: [{ label: 'Agent', was: action.seenState, now: state }],
    });
  }
  try {
    const outcome = await store.cancelTurnConfirmed({ sessionId, agentId, reason: 'user' });
    if (outcome.outcome === 'still_running') {
      return failedResult({ error: 'Still stopping. Try again on your Mac if it stays.' });
    }
    if (outcome.outcome === 'failed') {
      return failedResult({ error: "Couldn't stop the agent." });
    }
  } catch (error) {
    console.error('[bridge] stopAgent failed', error);
    return failedResult({ error: "Couldn't stop the agent." });
  }
  return doneResult();
};
