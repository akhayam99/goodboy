import type { ActionOutcome } from '../contract/actions';
import type { AppStore } from '../../../store/store';
import { beginAction, endAction, isInFlight, recordOutcome, replayOf } from './actionLedger';
import { takeRateSlot } from './actionLimits';
import { expectedActionIdOf } from './actionIds';
import { answerPermission } from './answerPermission';
import { answerQuestion } from './answerQuestion';
import { answerSlackReply } from './answerSlackReply';
import { approvePlan } from './approvePlan';
import { continueAgent } from './continueAgent';
import { continueRun } from './continueRun';
import type { DecideAction } from './decideAction';
import type { DecidePorts, HandlerResult } from './handlerTypes';
import { isRecordedRefusal, outcomeOf, plainRefusal } from './guardedOutcome';
import { mayDecideFromPhone } from './phoneScope';
import { raiseLimit } from './raiseLimit';
import { requestPlanChanges } from './requestPlanChanges';
import { sendToAgent } from './sendToAgent';
import { stopAgent } from './stopAgent';
import { stopAgentTree } from './stopAgentTree';
import { stopRun } from './stopRun';
import { sessionOfAction } from './targets';
import { undoRaiseLimit } from './undoRaiseLimit';

type RunParams = {
  readonly action: DecideAction;
  readonly getStore: () => AppStore;
  readonly ports: DecidePorts;
};

const runHandler = ({ action, getStore, ports }: RunParams): Promise<HandlerResult> => {
  switch (action.kind) {
    case 'answerQuestion':
      return answerQuestion({ action, getStore, ports });
    case 'approvePlan':
      return approvePlan({ action, getStore, ports });
    case 'requestPlanChanges':
      return requestPlanChanges({ action, getStore, ports });
    case 'answerPermission':
      return answerPermission({ action, getStore, ports });
    case 'raiseLimit':
      return raiseLimit({ action, getStore, ports });
    case 'undoRaiseLimit':
      return undoRaiseLimit({ action, getStore, ports });
    case 'stopRun':
      return stopRun({ action, getStore, ports });
    case 'continueRun':
      return continueRun({ action, getStore, ports });
    case 'stopAgent':
      return stopAgent({ action, getStore, ports });
    case 'continueAgent':
      return continueAgent({ action, getStore, ports });
    case 'stopAgentTree':
      return stopAgentTree({ action, getStore, ports });
    case 'sendToAgent':
      return sendToAgent({ action, getStore, ports });
    case 'answerSlackReply':
      return answerSlackReply({ action, getStore, ports });
    default: {
      const unexpected: never = action;
      throw new Error(`unsupported decide action: ${String(unexpected)}`);
    }
  }
};

type ExecuteParams = {
  readonly action: DecideAction;
  readonly phoneId: string | null;
  readonly getStore: () => AppStore;
  readonly ports: DecidePorts;
  readonly now?: number;
};

export const executeDecideAction = async ({
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
  if (expectedActionIdOf({ action }) !== action.actionId) {
    return plainRefusal({
      action,
      code: 'unknown-target',
      message: 'Your Mac did not offer this action. Refresh and try again.',
    });
  }
  if (!mayDecideFromPhone({ phoneId })) {
    return plainRefusal({
      action,
      code: 'not-permitted',
      message: 'This iPhone may not decide. Turn it on in Settings, iPhone on your Mac.',
    });
  }
  if (
    sessionOfAction({
      store: getStore(),
      workspaceId: action.workspaceId,
      sessionId: action.sessionId,
    }) === null
  ) {
    return plainRefusal({
      action,
      code: 'unknown-target',
      message: 'This session is not on your Mac.',
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
    const outcome = outcomeOf({ action, result: await runHandler({ action, getStore, ports }) });
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
