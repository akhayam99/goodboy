import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { BrowserTab, SessionClosed, TabOwner } from './types';

type SaveParams = {
  readonly id: string;
  readonly owner: TabOwner;
  readonly url: string;
  readonly title: string;
};

type OwnerParams = {
  readonly owner: TabOwner;
};

type ReorderParams = OwnerParams & {
  readonly ids: ReadonlyArray<string>;
};

type DeleteParams = OwnerParams & {
  readonly id: string;
};

type MoveParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

type WorkspaceParams = {
  readonly workspaceId: WorkspaceId;
};

export const browserTabCommands = {
  list: ({ owner }: OwnerParams) =>
    invokeCommand<ReadonlyArray<BrowserTab>>('browser_tab_rows_list', { args: { owner } }),
  listWorkspace: ({ workspaceId }: WorkspaceParams) =>
    invokeCommand<ReadonlyArray<BrowserTab>>('browser_workspace_tab_rows_list', {
      args: { workspaceId },
    }),
  save: ({ id, owner, url, title }: SaveParams) =>
    invokeCommand<BrowserTab>('browser_tab_row_save', { args: { id, owner, url, title } }),
  reorder: ({ owner, ids }: ReorderParams) =>
    invokeCommand<ReadonlyArray<BrowserTab>>('browser_tab_rows_reorder', { args: { owner, ids } }),
  remove: ({ owner, id }: DeleteParams) =>
    invokeCommand<null>('browser_tab_row_delete', { args: { owner, id } }),
  removeSessionRows: ({ sessionId }: SessionParams) =>
    invokeCommand<number>('browser_session_tab_rows_delete', { args: { sessionId } }),
  staleSessions: () => invokeCommand<ReadonlyArray<SessionId>>('browser_stale_tab_sessions'),
  pin: ({ id, sessionId, projectId }: MoveParams) =>
    invokeCommand<BrowserTab>('browser_tab_row_pin', { args: { id, sessionId, projectId } }),
  unpin: ({ id, sessionId, projectId }: MoveParams) =>
    invokeCommand<BrowserTab>('browser_tab_row_unpin', { args: { id, sessionId, projectId } }),
  closeSession: ({ sessionId }: SessionParams) =>
    invokeCommand<SessionClosed>('browser_session_close', { args: { sessionId } }),
};
