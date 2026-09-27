import type { SessionExternalTaskProvider, StarredIssue, WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../../features/inbox/types';
import type { StarredIssuesState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type WorkspaceParams = {
  readonly workspaceId: WorkspaceId;
};

export type StarRecordParams = WorkspaceParams & {
  readonly record: InboxRecord;
};

export type UnstarParams = WorkspaceParams & {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
};

export type RestoreStarsParams = WorkspaceParams & {
  readonly issues: ReadonlyArray<StarredIssue>;
};

export type RefreshStarsParams = WorkspaceParams & {
  readonly force?: boolean;
};

export type StarredIssuesSlice = StarredIssuesState & {
  loadStarredIssues(params: WorkspaceParams): Promise<void>;
  starIssueRecord(params: StarRecordParams): Promise<void>;
  unstarIssue(params: UnstarParams): Promise<void>;
  unstarClosedIssues(params: WorkspaceParams): Promise<ReadonlyArray<StarredIssue>>;
  restoreStarredIssues(params: RestoreStarsParams): Promise<void>;
  refreshStarredIssues(params: RefreshStarsParams): Promise<void>;
};
