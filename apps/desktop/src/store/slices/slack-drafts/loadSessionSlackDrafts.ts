import type { SessionId } from '@goodboy/types';
import { loadPendingSlackDraftsForSession } from '../../../features/integrations/slack/drafts';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SetFn } from './types';

const latest = createLatestOnly();

export const loadSessionSlackDrafts = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const claim = latest.claim({ key: sessionId });
    const drafts = await loadPendingSlackDraftsForSession(sessionId).catch(() => null);
    if (drafts === null || !claim.isCurrent()) {
      return;
    }
    set((state) => ({
      sessionSlackDrafts: { ...state.sessionSlackDrafts, [sessionId]: drafts },
    }));
  };
};
