import { turnRefusalOf } from '../../../store/slices/turn/refusal/turnRefusalOf';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { planTargetOf } from './planTargetOf';
import { sessionIdOf } from './ids';

export const requestPlanChanges = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'requestPlanChanges'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const found = planTargetOf({
    store: getStore(),
    sessionId,
    planId: action.planId,
    seenPlanVersion: action.seenPlanVersion,
  });
  if (!found.isFound) {
    return found.result;
  }
  const content = action.text.trim();
  if (content.length === 0) {
    return failedResult({ error: 'Say what should change.' });
  }
  try {
    const result = await getStore().sendTurn({
      sessionId,
      agentId: found.target.rootAgentId,
      content,
      origin: 'operator',
    });
    const refusal = turnRefusalOf({ result });
    if (refusal !== null) {
      return refusedResult({
        code: 'busy',
        message: 'The Lead cannot read your changes right now. Try again in a moment.',
      });
    }
  } catch (error) {
    console.error('[bridge] requestPlanChanges failed', error);
    return failedResult({ error: 'Could not send your changes to the Lead.' });
  }
  return doneResult();
};
