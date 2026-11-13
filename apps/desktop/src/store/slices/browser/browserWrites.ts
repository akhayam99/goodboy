import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';

type SessionKeyParams = {
  readonly sessionId: SessionId;
};

type ProjectKeyParams = {
  readonly projectId: ProjectId;
};

type WorkspaceKeyParams = {
  readonly workspaceId: WorkspaceId;
};

export const browserWrites = {
  loads: createLatestOnly(),
  queue: createSerialQueue(),
  workspaceReads: new Map<string, Promise<void>>(),
  writeKey: ({ sessionId }: SessionKeyParams) => `browser-tabs:${sessionId}`,
  sessionLoadKey: ({ sessionId }: SessionKeyParams) => `session:${sessionId}`,
  projectLoadKey: ({ projectId }: ProjectKeyParams) => `project:${projectId}`,
  workspaceLoadKey: ({ workspaceId }: WorkspaceKeyParams) => `workspace:${workspaceId}`,
};
