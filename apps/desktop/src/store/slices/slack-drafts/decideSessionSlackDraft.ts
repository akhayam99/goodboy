import type { IntegrationDraftId, SessionId } from '@goodboy/types';
import { decideSlackDraft } from '../../../features/integrations/slack/drafts';
import type { SetFn } from './types';

export type DecideSessionSlackDraftParams = {
  readonly sessionId: SessionId;
  readonly draftId: IntegrationDraftId;
  readonly status: 'sent' | 'discarded';
  readonly body?: string;
};

export const decideSessionSlackDraft = (set: SetFn) => {
  return async ({ sessionId, draftId, status, body }: DecideSessionSlackDraftParams) => {
    await decideSlackDraft({ id: draftId, status, ...(body === undefined ? {} : { body }) });
    set((state) => ({
      sessionSlackDrafts: {
        ...state.sessionSlackDrafts,
        [sessionId]: (state.sessionSlackDrafts[sessionId] ?? []).filter(
          (draft) => draft.id !== draftId,
        ),
      },
    }));
  };
};
