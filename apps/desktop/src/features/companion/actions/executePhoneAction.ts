import type { ActionOutcome } from '../contract/actions';
import type { AppStore } from '../../../store/store';
import { beginAction, endAction, isInFlight, recordOutcome, replayOf } from './actionLedger';
import { takeRateSlot } from './actionLimits';
import { isRecordedRefusal, outcomeOf, plainRefusal } from './guardedOutcome';
import type { HandlerResult, StartPorts } from './handlerTypes';
import { mergePrChecked } from './mergePrChecked';
import { mergeTrainAction } from './mergeTrainAction';
import { mayFromPhone, type PhonePermission } from './phonePermissionScope';
import {
  mergePrActionIdOf,
  startActionIdOf,
  stopTrainActionIdOf,
  trainActionIdOf,
} from './phoneActionIds';
import type { PhoneAction } from './parsePhoneAction';
import { startSession } from './startSession';
import { stopTrain } from './stopTrain';

type Expectation = {
  readonly actionId: string;
  readonly permission: PhonePermission;
};

type ExpectParams = {
  readonly action: PhoneAction;
};

const expectationOf = ({ action }: ExpectParams): Expectation => {
  switch (action.kind) {
    case 'mergePr':
      return {
        actionId: mergePrActionIdOf({
          prNumber: action.prNumber,
          headSha: action.expectedHeadSha,
        }),
        permission: 'merge',
      };
    case 'mergeTrain':
      return {
        actionId: trainActionIdOf({ workspaceId: action.workspaceId, entries: action.entries }),
        permission: 'merge',
      };
    case 'stopTrain':
      return { actionId: stopTrainActionIdOf({ trainId: action.trainId }), permission: 'merge' };
    case 'startSession':
      return {
        actionId: startActionIdOf({ workspaceId: action.workspaceId }),
        permission: 'start',
      };
    default: {
      const unexpected: never = action;
      throw new Error(`unsupported phone action: ${String(unexpected)}`);
    }
  }
};

type RunParams = {
  readonly action: PhoneAction;
  readonly getStore: () => AppStore;
  readonly ports: StartPorts;
  readonly now: number;
};

const runHandler = ({ action, getStore, ports, now }: RunParams): Promise<HandlerResult> => {
  switch (action.kind) {
    case 'mergePr':
      return mergePrChecked({ action, getStore });
    case 'mergeTrain':
      return mergeTrainAction({ action, getStore });
    case 'stopTrain':
      return stopTrain({ action, getStore });
    case 'startSession':
      return startSession({ action, getStore, ports, now });
    default: {
      const unexpected: never = action;
      throw new Error(`unsupported phone action: ${String(unexpected)}`);
    }
  }
};

type ExecuteParams = {
  readonly action: PhoneAction;
  readonly phoneId: string | null;
  readonly getStore: () => AppStore;
  readonly ports: StartPorts;
  readonly now?: number;
};

export const executePhoneAction = async ({
  action,
  phoneId,
  getStore,
  ports,
  now = Date.now(),
}: ExecuteParams): Promise<ActionOutcome> => {
  const replay = replayOf({ actionId: action.actionId });
  if (replay !== null) {
    return replay;
  }
  if (isInFlight({ actionId: action.actionId })) {
    return plainRefusal({
      action,
      code: 'duplicate-in-flight',
      message: 'This action is already running on your Mac.',
    });
  }
  const expected = expectationOf({ action });
  if (expected.actionId !== action.actionId) {
    return plainRefusal({
      action,
      code: 'unknown-target',
      message: 'Your Mac did not offer this action. Refresh and try again.',
    });
  }
  if (!mayFromPhone({ phoneId, permission: expected.permission })) {
    return plainRefusal({
      action,
      code: 'not-permitted',
      message:
        expected.permission === 'start'
          ? 'This iPhone may not start sessions. Turn it on in Settings, iPhone on your Mac.'
          : 'This iPhone may not merge. Turn it on in Settings, iPhone on your Mac.',
    });
  }
  if (!takeRateSlot({ kind: action.kind, now })) {
    return plainRefusal({
      action,
      code: 'rate-limited',
      message: 'Too many requests. Wait a moment and try again.',
    });
  }
  beginAction({ actionId: action.actionId });
  try {
    const outcome = outcomeOf({
      action,
      result: await runHandler({ action, getStore, ports, now }),
    });
    const isFinal =
      outcome.result === 'done' || (outcome.refusal !== null && isRecordedRefusal(outcome.refusal));
    if (isFinal) {
      recordOutcome({ outcome });
    }
    return outcome;
  } catch (error) {
    console.error(`[bridge] ${action.kind} crashed`, error);
    return outcomeOf({
      action,
      result: { kind: 'failed', error: 'The action failed on your Mac.' },
    });
  } finally {
    endAction({ actionId: action.actionId });
  }
};
