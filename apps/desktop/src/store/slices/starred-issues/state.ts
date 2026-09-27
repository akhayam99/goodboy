import type { StarredIssue, WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../../features/inbox/types';

export type StarredIssuesState = {
  readonly starredIssues: Readonly<Record<WorkspaceId, ReadonlyArray<StarredIssue>>>;
  readonly starredRecords: Readonly<Record<WorkspaceId, Readonly<Record<string, InboxRecord>>>>;
  readonly starredRefreshedAt: Readonly<Record<WorkspaceId, number>>;
};

export const starredIssuesInitialState: StarredIssuesState = {
  starredIssues: {},
  starredRecords: {},
  starredRefreshedAt: {},
};
