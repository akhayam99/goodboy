import type { ActionOutcome, Refusal } from '../contract/actions';
import type { ActionId } from '../contract/primitives';
import type { HandlerResult } from './handlerTypes';

type ActionRef = {
  readonly actionId: ActionId;
};

type RefuseParams = {
  readonly action: ActionRef;
  readonly refusal: Refusal;
};

export const refusedOutcome = ({ action, refusal }: RefuseParams): ActionOutcome => ({
  actionId: action.actionId,
  result: 'refused',
  isReplay: false,
  refusal,
  error: null,
  undoActionId: null,
  createdSessionId: null,
  createdChatId: null,
});

type RefusalParams = {
  readonly action: ActionRef;
  readonly code: Refusal['code'];
  readonly message: string;
};

export const plainRefusal = ({ action, code, message }: RefusalParams): ActionOutcome =>
  refusedOutcome({ action, refusal: { code, message, changes: [] } });

export const isRecordedRefusal = ({ code }: Refusal): boolean =>
  code === 'version-changed' || code === 'already-decided';

type OutcomeParams = {
  readonly action: ActionRef;
  readonly result: HandlerResult;
};

export const outcomeOf = ({ action, result }: OutcomeParams): ActionOutcome => {
  if (result.kind === 'refused') {
    return refusedOutcome({ action, refusal: result.refusal });
  }
  if (result.kind === 'failed') {
    return {
      actionId: action.actionId,
      result: 'failed',
      isReplay: false,
      refusal: null,
      error: result.error,
      undoActionId: null,
      createdSessionId: null,
      createdChatId: null,
    };
  }
  return {
    actionId: action.actionId,
    result: 'done',
    isReplay: false,
    refusal: null,
    error: null,
    undoActionId: result.undoActionId,
    createdSessionId: result.createdSessionId,
    createdChatId: result.createdChatId,
  };
};
