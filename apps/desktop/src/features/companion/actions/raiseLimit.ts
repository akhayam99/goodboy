import { expectedActionIdOf } from './actionIds';
import { limitOffersOf } from './actionLimits';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { saveLimitUndo } from './limitUndos';
import { isLimitRunOfSession } from './limitTargets';
import { sessionIdOf } from './ids';

export const raiseLimit = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'raiseLimit'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const store = getStore();
  if (!isLimitRunOfSession({ store, sessionId, runId: action.runId })) {
    return refusedResult({ code: 'unknown-target', message: 'This run is not on your Mac.' });
  }
  const budget = store.sessionBudgets[sessionId];
  if (budget === undefined || budget.softCapUsd !== action.seenLimit) {
    return refusedResult({
      code: 'version-changed',
      message: 'The limit changed while you read it.',
      changes: [
        {
          label: 'Limit',
          was: `$${action.seenLimit.toFixed(2)}`,
          now: budget === undefined ? 'No limit' : `$${budget.softCapUsd.toFixed(2)}`,
        },
      ],
    });
  }
  if (!limitOffersOf({ currentLimit: budget.softCapUsd }).includes(action.offeredAmount)) {
    return refusedResult({
      code: 'not-permitted',
      message: 'That amount was not offered by your Mac.',
    });
  }
  try {
    await store.setSessionBudget(sessionId, action.offeredAmount, budget.onExceed);
  } catch (error) {
    console.error('[bridge] raiseLimit failed', error);
    return failedResult({ error: 'Could not raise the limit.' });
  }
  const undoActionId = expectedActionIdOf({
    action: {
      kind: 'undoRaiseLimit',
      actionId: '',
      workspaceId: action.workspaceId,
      sessionId: action.sessionId,
      runId: action.runId,
      raisedActionId: action.actionId,
    },
  });
  saveLimitUndo({
    raisedActionId: action.actionId,
    undo: {
      sessionId: action.sessionId,
      runId: action.runId,
      previousLimit: budget.softCapUsd,
      raisedLimit: action.offeredAmount,
    },
  });
  return doneResult({ undoActionId });
};
