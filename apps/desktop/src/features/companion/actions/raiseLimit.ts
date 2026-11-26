import { expectedActionIdOf } from './actionIds';
import { limitOffersOf } from './actionLimits';
import { applyLimit } from './applyLimit';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { refusedResult, doneResult } from './handlerResults';
import { saveLimitUndo } from './limitUndos';
import { limitScopeOfStore, limitTargetOf } from './limitTargets';
import { serializedBy } from './sessionLock';

export const raiseLimit = ({
  action,
  getStore,
  ports,
}: HandlerParams<DecideActionOf<'raiseLimit'>>): Promise<HandlerResult> =>
  serializedBy({
    key: action.sessionId,
    work: async () => {
      const store = getStore();
      const target = limitTargetOf({
        scope: limitScopeOfStore({ store }),
        sessionId: action.sessionId,
        runId: action.runId,
      });
      if (target === null) {
        return refusedResult({ code: 'unknown-target', message: "This run isn't on your Mac." });
      }
      if (target.limit !== action.seenLimit) {
        return refusedResult({
          code: 'version-changed',
          message: 'The limit changed while you read it.',
          changes: [
            {
              label: 'Limit',
              was: `$${action.seenLimit.toFixed(2)}`,
              now: `$${target.limit.toFixed(2)}`,
            },
          ],
        });
      }
      if (!limitOffersOf({ currentLimit: target.limit }).includes(action.offeredAmount)) {
        return refusedResult({
          code: 'not-permitted',
          message: 'That amount was not offered by your Mac.',
        });
      }
      const applied = await applyLimit({
        store,
        ports,
        sessionId: action.sessionId,
        runId: action.runId,
        target,
        nextLimit: action.offeredAmount,
        failure: "Couldn't raise the limit.",
      });
      if (applied.kind !== 'done') {
        return applied;
      }
      saveLimitUndo({
        raisedActionId: action.actionId,
        undo: {
          kind: target.kind,
          sessionId: action.sessionId,
          runId: action.runId,
          previousLimit: target.limit,
          raisedLimit: action.offeredAmount,
        },
      });
      return doneResult({
        undoActionId: expectedActionIdOf({
          action: {
            kind: 'undoRaiseLimit',
            actionId: '',
            workspaceId: action.workspaceId,
            sessionId: action.sessionId,
            runId: action.runId,
            raisedActionId: action.actionId,
          },
        }),
      });
    },
  });
