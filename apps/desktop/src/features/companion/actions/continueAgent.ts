import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { agentStateOf, isAgentOfSession } from './targets';
import { sessionIdOf, agentIdOf } from './ids';

export const continueAgent = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'continueAgent'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const agentId = agentIdOf({ value: action.agentId });
  const store = getStore();
  if (!isAgentOfSession({ store, sessionId, agentId })) {
    return refusedResult({ code: 'unknown-target', message: "This agent isn't on your Mac." });
  }
  const state = agentStateOf({ store, sessionId, agentId });
  if (state === 'running') {
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
    await store.continueStoppedAgent({ sessionId, agentId });
  } catch (error) {
    console.error('[bridge] continueAgent failed', error);
    return failedResult({ error: "Couldn't continue the agent." });
  }
  return doneResult();
};
