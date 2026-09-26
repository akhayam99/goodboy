import type { IsoDateTime, WorkspaceId } from './ids';
import type { SessionExternalTaskProvider } from './workspace';

export type StarredIssueState = 'open' | 'active' | 'done' | 'alert' | 'missing';

export type StarredIssue = Readonly<{
  workspaceId: WorkspaceId;
  provider: SessionExternalTaskProvider;
  externalId: string;
  identifier: string;
  container: string | null;
  title: string;
  url: string;
  state: StarredIssueState;
  stateLabel: string | null;
  starredAt: IsoDateTime;
  refreshedAt: IsoDateTime | null;
}>;
