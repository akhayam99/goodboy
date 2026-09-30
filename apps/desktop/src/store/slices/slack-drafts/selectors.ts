import type { IntegrationDraft, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';

const EMPTY_SLACK_DRAFTS: ReadonlyArray<IntegrationDraft> = [];

export const useSessionSlackDrafts = (
  sessionId: SessionId | null,
): ReadonlyArray<IntegrationDraft> =>
  useAppStore((s) =>
    sessionId ? (s.sessionSlackDrafts[sessionId] ?? EMPTY_SLACK_DRAFTS) : EMPTY_SLACK_DRAFTS,
  );
