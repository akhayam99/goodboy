import type { ProjectId, SessionId } from '@goodboy/types';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';

type SessionKeyParams = {
  readonly sessionId: SessionId;
};

type ProjectKeyParams = {
  readonly projectId: ProjectId;
};

export const browserWrites = {
  loads: createLatestOnly(),
  queue: createSerialQueue(),
  writeKey: 'browser-tabs',
  sessionLoadKey: ({ sessionId }: SessionKeyParams) => `session:${sessionId}`,
  projectLoadKey: ({ projectId }: ProjectKeyParams) => `project:${projectId}`,
};
