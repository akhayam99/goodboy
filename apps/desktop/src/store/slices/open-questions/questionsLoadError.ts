import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { AppStore } from '../../store';

type SessionParams = {
  readonly sessionId: SessionId;
};

type RecordParams = SessionParams & {
  readonly error: unknown;
};

export const clearQuestionsLoadError =
  ({ sessionId }: SessionParams) =>
  (state: AppStore): Partial<AppStore> => {
    if (state.sessionQuestionsLoadError[sessionId] === undefined) {
      return state;
    }
    return {
      sessionQuestionsLoadError: { ...state.sessionQuestionsLoadError, [sessionId]: undefined },
    };
  };

export const recordQuestionsLoadError =
  ({ sessionId, error }: RecordParams) =>
  (state: AppStore): Partial<AppStore> => ({
    sessionQuestionsLoadError: {
      ...state.sessionQuestionsLoadError,
      [sessionId]: formatError(error),
    },
  });
