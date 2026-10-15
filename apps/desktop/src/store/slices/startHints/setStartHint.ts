import type { SessionId } from '@goodboy/types';
import type { SetFn } from '../../slice-types';
import { START_HINT_LIMITS } from './startHintLimits';

export type SetStartHintParams = {
  readonly sessionId: SessionId;
  readonly scope: string;
  readonly text: string;
};

export const setStartHint = (set: SetFn) => {
  return ({ sessionId, scope, text }: SetStartHintParams): void => {
    set((state) => {
      const forSession = { ...state.startHints[sessionId] };
      if (text === '') {
        delete forSession[scope];
      }
      if (text !== '') {
        forSession[scope] = {
          text: text.slice(0, START_HINT_LIMITS.max),
          revision: state.startHintRevision + 1,
        };
      }
      return {
        startHintRevision: state.startHintRevision + 1,
        startHints: { ...state.startHints, [sessionId]: forSession },
      };
    });
  };
};
