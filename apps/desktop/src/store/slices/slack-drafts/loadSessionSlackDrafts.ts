import type { SessionId } from '@goodboy/types';
import { loadPendingSlackDraftsForSession } from '../../../features/integrations/slack/drafts';
import type { SetFn } from './types';

export const loadSessionSlackDrafts = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const drafts = await loadPendingSlackDraftsForSession(sessionId).catch(() => null);
    if (drafts === null) {
      return;
    }
    set((state) => ({
      sessionSlackDrafts: { ...state.sessionSlackDrafts, [sessionId]: drafts },
    }));
  };
};
