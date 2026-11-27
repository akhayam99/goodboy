import type { IntegrationDraftId, SessionId } from '@goodboy/types';
import { decideSlackDraft } from '../../../features/integrations/slack/drafts';
import { announceSessionFact } from '../../../shared/lib/dataChanged/announceSessionFact';
import type { GetFn, SetFn } from './types';

export type DecideSessionSlackDraftParams = {
  readonly sessionId: SessionId;
  readonly draftId: IntegrationDraftId;
  readonly status: 'sent' | 'discarded';
  readonly body?: string;
};

export const decideSessionSlackDraft = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, draftId, status, body }: DecideSessionSlackDraftParams) => {
    await decideSlackDraft({ id: draftId, status, ...(body === undefined ? {} : { body }) });
    announceSessionFact({ kind: 'slack-draft', sessionId });
    set((state) => ({
      sessionSlackDrafts: {
        ...state.sessionSlackDrafts,
        [sessionId]: (state.sessionSlackDrafts[sessionId] ?? []).filter(
          (draft) => draft.id !== draftId,
        ),
      },
    }));
    await get().loadSessionSlackDrafts(sessionId);
  };
};
