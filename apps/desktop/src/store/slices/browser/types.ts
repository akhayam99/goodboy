import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';

export type { GetFn } from '../../slice-types';

export type BrowserTab = {
  readonly id: string;
  readonly sessionId: SessionId | null;
  readonly projectId: ProjectId | null;
  readonly url: string;
  readonly title: string;
  readonly position: number;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type TabOwner =
  | { readonly kind: 'session'; readonly sessionId: SessionId }
  | { readonly kind: 'project'; readonly projectId: ProjectId };

export type TabCloseFailure = {
  readonly tabId: string;
  readonly reason: string;
};

export type SessionClosed = {
  readonly closed: number;
  readonly failed: ReadonlyArray<TabCloseFailure>;
};

export type ClosedBrowserTab = {
  readonly url: string;
  readonly title: string;
};

export type SessionTabParams = {
  readonly sessionId: SessionId;
  readonly tabId: string;
};

export type LiveTabParams = SessionTabParams & {
  readonly liveId: string;
};

export type OpenTabParams = SessionTabParams & {
  readonly url: string;
  readonly title: string;
};

export type ReorderTabsParams = {
  readonly sessionId: SessionId;
  readonly ids: ReadonlyArray<string>;
};

export type PinTabParams = SessionTabParams & {
  readonly projectId: ProjectId;
};

export type SessionParams = {
  readonly sessionId: SessionId;
};

export type WorkspaceParams = {
  readonly workspaceId: WorkspaceId;
};

export type ProjectParams = {
  readonly projectId: ProjectId;
};
