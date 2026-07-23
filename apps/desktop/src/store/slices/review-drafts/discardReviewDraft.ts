import { deletePrReviewDraft } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const discardReviewDraft = (set: SetFn) => {
  return async (id: string): Promise<void> => {
    await deletePrReviewDraft({ db: tauriDatabase, id });
    set((state) => {
      const sessionId = (Object.keys(state.reviewDrafts) as SessionId[]).find((key) =>
        (state.reviewDrafts[key] ?? []).some((draft) => draft.id === id),
      );
      if (sessionId == null) {
        return {};
      }
      return {
        reviewDrafts: {
          ...state.reviewDrafts,
          [sessionId]: (state.reviewDrafts[sessionId] ?? []).filter((draft) => draft.id !== id),
        },
      };
    });
  };
};
