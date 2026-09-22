import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { cancelQuestionDelegates } from './cancelQuestionDelegates';
import type { GetFn, SetFn } from './types';

export type TakeQuestionBackParams = {
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
};

export const takeQuestionBack = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, questionId }: TakeQuestionBackParams): Promise<void> => {
    await cancelQuestionDelegates({ set, get, sessionId, questionIds: [questionId] });
  };
};
