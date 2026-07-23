import { listPrReviewDraftsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadReviewDrafts = (set: SetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const drafts = await listPrReviewDraftsForSession({ db: tauriDatabase, sessionId });
    set((state) => ({
      reviewDrafts: { ...state.reviewDrafts, [sessionId]: drafts },
    }));
  };
};
