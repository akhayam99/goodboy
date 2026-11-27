import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { markOpenQuestionAnswered } from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core/context';
import { tauriDatabase } from '../../../shared/lib/db';
import { announceSessionFact } from '../../../shared/lib/dataChanged/announceSessionFact';
import type { GetFn } from './types';

export type OpenQuestionAnswerPair = {
  readonly id: OpenQuestionId;
  readonly text: string;
  readonly answer: string;
};

type PersistOpenQuestionAnswersParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly pairs: ReadonlyArray<OpenQuestionAnswerPair>;
};

export const persistOpenQuestionAnswers = async ({
  get,
  sessionId,
  pairs,
}: PersistOpenQuestionAnswersParams): Promise<void> => {
  const outcomes = await Promise.allSettled(
    pairs.map((pair) => markOpenQuestionAnswered(tauriDatabase, pair.id, pair.answer)),
  );
  const answered = pairs.filter((_, index) => outcomes[index]?.status === 'fulfilled');
  if (answered.length > 0) {
    announceSessionFact({ kind: 'open-question', sessionId });
    const isSlotChanged = await removeQuestionsFromSlot(
      tauriDatabase,
      sessionId,
      answered.map((pair) => pair.text),
    );
    await get().loadSessionOpenQuestions(sessionId);
    await get().loadSessionAnsweredQuestions(sessionId);
    if (isSlotChanged) {
      await get().loadSessionSlots(sessionId);
    }
  }
  const failure = outcomes.find(
    (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
  );
  if (failure !== undefined) {
    throw failure.reason;
  }
};
