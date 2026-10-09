import { askDraftKeyOf } from './askDraftKeyOf';
import type { SetAskDraftParams, SetFn } from './types';

export const setAskDraft =
  (set: SetFn) =>
  ({ sessionId, threadId, text }: SetAskDraftParams): void => {
    const key = askDraftKeyOf({ sessionId, threadId });
    set((state) => {
      if (text === '') {
        if (state.askDrafts[key] === undefined) {
          return state;
        }
        return {
          askDrafts: Object.fromEntries(
            Object.entries(state.askDrafts).filter(([draftKey]) => draftKey !== key),
          ),
        };
      }
      if (state.askDrafts[key] === text) {
        return state;
      }
      return { askDrafts: { ...state.askDrafts, [key]: text } };
    });
  };
