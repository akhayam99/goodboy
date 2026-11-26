import type { ChangedFact, RefusalCode } from '../contract/actions';
import type { ActionId } from '../contract/primitives';
import type { HandlerResult } from './handlerTypes';

type DoneParams = {
  readonly undoActionId?: ActionId | null;
};

export const doneResult = ({ undoActionId = null }: DoneParams = {}): HandlerResult => ({
  kind: 'done',
  undoActionId,
});

type RefusedParams = {
  readonly code: RefusalCode;
  readonly message: string;
  readonly changes?: ReadonlyArray<ChangedFact>;
};

export const refusedResult = ({ code, message, changes = [] }: RefusedParams): HandlerResult => ({
  kind: 'refused',
  refusal: { code, message, changes },
});

type FailedParams = {
  readonly error: string;
};

export const failedResult = ({ error }: FailedParams): HandlerResult => ({
  kind: 'failed',
  error,
});
