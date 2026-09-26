import type { ProjectSentryLink, WorkspaceId } from '@goodboy/types';

export type SentryLinksState = {
  readonly projectSentryLinks: Readonly<Record<WorkspaceId, ReadonlyArray<ProjectSentryLink>>>;
};

export const sentryLinksInitialState: SentryLinksState = {
  projectSentryLinks: {},
};
