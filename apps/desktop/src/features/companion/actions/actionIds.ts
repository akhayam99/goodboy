import type { ActionId } from '../contract/primitives';
import type { DecideAction } from './decideAction';

type ActionParams = {
  readonly action: DecideAction;
};

type Target = {
  readonly objectId: string;
  readonly version: string;
};

const actionTargetOf = ({ action }: ActionParams): Target => {
  switch (action.kind) {
    case 'answerQuestion':
      return { objectId: action.questionId, version: action.seenVersion };
    case 'approvePlan':
    case 'requestPlanChanges':
      return { objectId: action.planId, version: String(action.seenPlanVersion) };
    case 'answerPermission':
      return { objectId: action.requestId, version: action.seenInputHash };
    case 'raiseLimit':
      return { objectId: action.runId, version: String(action.seenLimit) };
    case 'undoRaiseLimit':
      return { objectId: action.runId, version: action.raisedActionId };
    case 'stopRun':
    case 'continueRun':
      return { objectId: action.runId, version: action.seenState };
    case 'stopAgent':
    case 'continueAgent':
      return { objectId: action.agentId, version: action.seenState };
    case 'stopAgentTree':
      return { objectId: action.agentId, version: action.seenState };
    case 'sendToAgent':
      return { objectId: action.agentId, version: action.seenVersion };
    case 'answerSlackReply':
      return { objectId: action.draftId, version: action.seenVersion };
    default: {
      const unexpected: never = action;
      throw new Error(`unsupported decide action: ${String(unexpected)}`);
    }
  }
};

export const expectedActionIdOf = ({ action }: ActionParams): ActionId => {
  const { objectId, version } = actionTargetOf({ action });
  return `act:${action.kind}:${objectId}:${version}`;
};
