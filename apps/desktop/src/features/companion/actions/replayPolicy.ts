import type { AppStore } from '../../../store/store';
import type { DecideAction, DecideKind } from './decideAction';
import { limitOfKind, limitScopeOfStore } from './limitTargets';
import { limitUndoOf } from './limitUndos';

const REPEATABLE_KINDS: ReadonlySet<DecideKind> = new Set([
  'stopRun',
  'continueRun',
  'stopAgent',
  'continueAgent',
  'stopAgentTree',
]);

type KindParams = {
  readonly kind: DecideKind;
};

export const isReplayableKind = ({ kind }: KindParams): boolean => !REPEATABLE_KINDS.has(kind);

type StaleParams = {
  readonly action: DecideAction;
  readonly store: AppStore;
};

export const isStaleReplay = ({ action, store }: StaleParams): boolean => {
  if (action.kind === 'undoRaiseLimit') {
    return limitUndoOf({ raisedActionId: action.raisedActionId }) !== null;
  }
  if (action.kind !== 'raiseLimit') {
    return false;
  }
  const scope = limitScopeOfStore({ store });
  return !(['run', 'tree', 'session'] as const).some(
    (kind) =>
      limitOfKind({ scope, sessionId: action.sessionId, runId: action.runId, kind })?.limit ===
      action.offeredAmount,
  );
};
