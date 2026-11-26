import type { HandlerParams, HandlerResult } from './handlerTypes';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import { questionVersionOf } from './versions';
import { sessionIdOf } from './ids';
import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';

type RedeliverParams = {
  readonly sessionId: SessionId;
  readonly attemptId: string;
  readonly getStore: () => AppStore;
};

const redeliverAnswer = async ({
  sessionId,
  attemptId,
  getStore,
}: RedeliverParams): Promise<HandlerResult> => {
  try {
    await getStore().retryOpenQuestionDelivery({ sessionId, attemptId });
  } catch (error) {
    console.error('[bridge] answerQuestion redelivery failed', error);
    return failedResult({ error: "Couldn't send your answer." });
  }
  return getStore().pendingOpenQuestionDeliveries[sessionId]?.attemptId === attemptId
    ? failedResult({ error: "Couldn't send your answer. The agent isn't reachable." })
    : doneResult();
};

export const answerQuestion = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'answerQuestion'>>): Promise<HandlerResult> => {
  const sessionId = sessionIdOf({ value: action.sessionId });
  const store = getStore();
  const open = (store.sessionOpenQuestions[sessionId] ?? []).find(
    (question) => question.id === action.questionId && question.status === 'open',
  );
  if (open === undefined) {
    const pending = store.pendingOpenQuestionDeliveries[sessionId];
    if (pending?.pairs.some((pair) => pair.id === action.questionId) === true) {
      return redeliverAnswer({ sessionId, attemptId: pending.attemptId, getStore });
    }
    const isDecided = [
      ...(store.sessionAnsweredQuestions[sessionId] ?? []),
      ...(store.sessionDismissedQuestions[sessionId] ?? []),
    ].some((question) => question.id === action.questionId);
    return isDecided
      ? refusedResult({ code: 'already-decided', message: 'Answered on your Mac.' })
      : refusedResult({ code: 'unknown-target', message: "This question isn't on your Mac." });
  }
  if (questionVersionOf({ question: open }) !== action.seenVersion) {
    return refusedResult({
      code: 'version-changed',
      message: 'The question changed while you read it.',
      changes: [{ label: 'Question', was: 'as you read it', now: open.text }],
    });
  }
  const answer = action.text.trim();
  if (answer.length === 0) {
    return failedResult({ error: 'The answer is empty.' });
  }
  try {
    await store.answerOpenQuestions(
      sessionId,
      [{ id: open.id, text: open.text, answer }],
      open.createdByAgentId ?? null,
    );
  } catch (error) {
    console.error('[bridge] answerQuestion failed', error);
    return failedResult({ error: "Couldn't send your answer." });
  }
  return doneResult();
};
