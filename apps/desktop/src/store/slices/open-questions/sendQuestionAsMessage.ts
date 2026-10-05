import type { OpenQuestion, SessionId } from '@goodboy/types';
import { cancelQuestionDelegates } from './cancelQuestionDelegates';
import { settleDismissedQuestion } from './dismissOpenQuestion';
import { isReportedError } from '../notifications/reportedError';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
  readonly text: string;
};

export const sendQuestionAsMessage = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, question, text }: Params): Promise<void> => {
    const agentId = question.createdByAgentId;
    const content = text.trim();
    if (agentId == null || content.length === 0) {
      return;
    }
    await cancelQuestionDelegates({ set, get, sessionId, questionIds: [question.id] });
    await settleDismissedQuestion({ set, get, sessionId, question });
    try {
      await get().sendTurn({ sessionId, agentId, content });
    } catch (error) {
      if (isReportedError(error)) {
        return;
      }
      void get().reportError({ title: "The message didn't send", error, sessionId });
    }
  };
};
