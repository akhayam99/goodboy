import type { ProjectId, SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

export const projectWorktreesEventOf = ({ sessionId, projectId }: Params): string =>
  `goodboy:project-worktrees:${sessionId}:${projectId}`;
