import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { markOpenQuestionAnswered } from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
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
  await Promise.all(
    pairs.map((pair) => markOpenQuestionAnswered(tauriDatabase, pair.id, pair.answer)),
  );
  const slotChanged = await removeQuestionsFromSlot(
    tauriDatabase,
    sessionId,
    pairs.map((pair) => pair.text),
  );
  await get().loadSessionOpenQuestions(sessionId);
  await get().loadSessionAnsweredQuestions(sessionId);
  if (slotChanged) {
    await get().loadSessionSlots(sessionId);
  }
};
