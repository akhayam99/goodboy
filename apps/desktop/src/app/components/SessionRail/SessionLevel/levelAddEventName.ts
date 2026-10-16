import type { ProjectId, SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId | null;
};

export const levelAddEventName = ({ sessionId, projectId }: Params): string =>
  projectId === null
    ? `goodboy:level-add-project:${sessionId}`
    : `goodboy:level-new-branch:${sessionId}:${projectId}`;
