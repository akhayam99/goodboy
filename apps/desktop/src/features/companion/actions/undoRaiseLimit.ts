import type { SessionId } from '@goodboy/types';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { dropLimitUndo, limitUndoOf } from './limitUndos';

export const undoRaiseLimit = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'undoRaiseLimit'>>): Promise<HandlerResult> => {
  const sessionId = action.sessionId as SessionId;
  const undo = limitUndoOf({ raisedActionId: action.raisedActionId });
  if (undo === null || undo.sessionId !== action.sessionId || undo.runId !== action.runId) {
    return refusedResult({ code: 'unknown-target', message: 'There is nothing to undo.' });
  }
  const budget = getStore().sessionBudgets[sessionId];
  if (budget === undefined || budget.softCapUsd !== undo.raisedLimit) {
    return refusedResult({
      code: 'version-changed',
      message: 'The limit changed after you raised it.',
      changes: [
        {
          label: 'Limit',
          was: `$${undo.raisedLimit.toFixed(2)}`,
          now: budget === undefined ? 'No limit' : `$${budget.softCapUsd.toFixed(2)}`,
        },
      ],
    });
  }
  try {
    await getStore().setSessionBudget(sessionId, undo.previousLimit, budget.onExceed);
  } catch (error) {
    console.error('[bridge] undoRaiseLimit failed', error);
    return failedResult({ error: 'Could not restore the limit.' });
  }
  dropLimitUndo({ raisedActionId: action.raisedActionId });
  return doneResult();
};
