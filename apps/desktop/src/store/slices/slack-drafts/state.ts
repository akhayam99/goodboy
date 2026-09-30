import type { SessionId, IntegrationDraft } from '@goodboy/types';

export type SlackDraftsState = {
  readonly sessionSlackDrafts: Readonly<Record<SessionId, ReadonlyArray<IntegrationDraft>>>;
};

export const slackDraftsInitialState: SlackDraftsState = {
  sessionSlackDrafts: {},
};
