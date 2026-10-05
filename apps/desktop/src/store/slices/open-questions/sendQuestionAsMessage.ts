import type { OpenQuestion, SessionId } from '@goodboy/types';
import { cancelQuestionDelegates } from './cancelQuestionDelegates';
import { settleDismissedQuestion } from './dismissOpenQuestion';
import { isReportedError } from '../notifications/reportedError';
import type { SendTurnResult } from '../turn/types';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
  readonly text: string;
};

const refusalOf = (result: SendTurnResult): string | null => {
  if (result.blockedOverBudget) {
    return 'The session budget is reached. Raise it to send this message.';
  }
  if (result.isWriterLeaseDenied === true) {
    return 'Another agent is writing in this folder. Try again in a moment.';
  }
  return null;
};

export const sendQuestionAsMessage = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, question, text }: Params): Promise<boolean> => {
    const agentId = question.createdByAgentId;
    const content = text.trim();
    if (agentId == null || content.length === 0) {
      return false;
    }
    let result: SendTurnResult;
    try {
      result = await get().sendTurn({ sessionId, agentId, content });
    } catch (error) {
      if (!isReportedError(error)) {
        void get().reportError({ title: "The message didn't send", error, sessionId });
      }
      return false;
    }
    const refusal = refusalOf(result);
    if (refusal !== null) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "The message didn't send",
        body: refusal,
        sessionId,
        coalesceKey: `question-message-refused:${question.id}`,
      });
      return false;
    }
    await cancelQuestionDelegates({ set, get, sessionId, questionIds: [question.id] });
    const stillOpen = (get().sessionOpenQuestions[sessionId] ?? []).some(
      (candidate) => candidate.id === question.id,
    );
    if (stillOpen) {
      await settleDismissedQuestion({ set, get, sessionId, question });
    }
    return true;
  };
};
