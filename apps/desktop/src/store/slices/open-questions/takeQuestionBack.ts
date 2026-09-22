import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { cancelQuestionDelegates } from './cancelQuestionDelegates';
import type { GetFn, SetFn } from './types';

export const takeQuestionBack = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, questionId: OpenQuestionId): Promise<void> => {
    await cancelQuestionDelegates({ set, get, sessionId, questionIds: [questionId] });
  };
};
