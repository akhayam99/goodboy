import { updatePrReviewDraftBody } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const updateReviewDraft = (set: SetFn) => {
  return async (id: string, body: string): Promise<void> => {
    await updatePrReviewDraftBody({ db: tauriDatabase, id, body });
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
          [sessionId]: (state.reviewDrafts[sessionId] ?? []).map((draft) =>
            draft.id === id ? { ...draft, body } : draft,
          ),
        },
      };
    });
  };
};
