import { markOpenQuestionAnswersDelivered } from '@goodboy/db';
import type { OpenQuestion } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { persistOpenQuestionAnswers } from '../open-questions/persistOpenQuestionAnswers';
import { continueResolveLaunch, type ContinueEntry } from './continueResolveLaunch';
import { attemptsOfLaunch } from './resolveLaunch';
import { openQuestionOfThread } from './threadQuestions';
import type { AnswerQuestionsParams, GetFn } from './types';

type Params = { readonly get: GetFn } & AnswerQuestionsParams;

const NOT_IN_RUN = 'That comment is not part of this fix run';

export const answerQuestions = async ({
  get,
  sessionId,
  launchId,
  answers,
}: Params): Promise<void> => {
  const given = answers.filter((item) => item.answer.trim().length > 0);
  if (given.length === 0) {
    return;
  }
  const state = get();
  const attempts = state.sessionResolveAttempts[sessionId] ?? [];
  const launch = attemptsOfLaunch({ attempts, launchKey: launchId });
  const attemptIds = new Set(launch.map((attempt) => attempt.id));
  const threads = state.sessionResolveThreads[sessionId] ?? [];
  const questions = state.sessionOpenQuestions[sessionId] ?? [];
  const entries: Array<ContinueEntry> = [];
  const pairs: Array<{
    readonly id: OpenQuestion['id'];
    readonly text: string;
    readonly answer: string;
  }> = [];
  for (const { threadId, answer } of given) {
    const thread = threads.find((item) => item.threadId === threadId);
    if (
      thread === undefined ||
      thread.activeAttemptId === null ||
      !attemptIds.has(thread.activeAttemptId)
    ) {
      throw new Error(NOT_IN_RUN);
    }
    entries.push({ threadId, intent: 'answer', question: thread.question, answer: answer.trim() });
    const open = openQuestionOfThread({ questions, attempts, threadId, question: thread.question });
    if (open !== undefined) {
      pairs.push({ id: open.id, text: open.text, answer: answer.trim() });
    }
  }
  if (pairs.length > 0) {
    await persistOpenQuestionAnswers({ get, sessionId, pairs });
    await markOpenQuestionAnswersDelivered({ db: tauriDatabase, ids: pairs.map(({ id }) => id) });
    await get().loadSessionAnsweredQuestions(sessionId);
  }
  await continueResolveLaunch({ get, sessionId, entries });
};
