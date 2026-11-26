import { applyLimit } from './applyLimit';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, refusedResult } from './handlerResults';
import { dropLimitUndo, limitUndoOf } from './limitUndos';
import { limitOfKind, limitScopeOfStore } from './limitTargets';
import { serializedBy } from './sessionLock';

export const undoRaiseLimit = ({
  action,
  getStore,
  ports,
}: HandlerParams<DecideActionOf<'undoRaiseLimit'>>): Promise<HandlerResult> =>
  serializedBy({
    key: action.sessionId,
    work: async () => {
      const undo = limitUndoOf({ raisedActionId: action.raisedActionId });
      if (undo === null || undo.sessionId !== action.sessionId || undo.runId !== action.runId) {
        return refusedResult({ code: 'unknown-target', message: 'There is nothing to undo.' });
      }
      const store = getStore();
      const target = limitOfKind({
        scope: limitScopeOfStore({ store }),
        sessionId: action.sessionId,
        runId: action.runId,
        kind: undo.kind,
      });
      if (target === null || target.limit !== undo.raisedLimit) {
        return refusedResult({
          code: 'version-changed',
          message: 'The limit changed after you raised it.',
          changes: [
            {
              label: 'Limit',
              was: `$${undo.raisedLimit.toFixed(2)}`,
              now: target === null ? 'No limit' : `$${target.limit.toFixed(2)}`,
            },
          ],
        });
      }
      const applied = await applyLimit({
        store,
        ports,
        sessionId: action.sessionId,
        runId: action.runId,
        target,
        nextLimit: undo.previousLimit,
        failure: "Couldn't restore the limit.",
      });
      if (applied.kind !== 'done') {
        return applied;
      }
      dropLimitUndo({ raisedActionId: action.raisedActionId });
      return doneResult();
    },
  });
