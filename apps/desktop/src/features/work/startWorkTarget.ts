import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';

export type StartWorkTarget = Readonly<{
  workspaceId: WorkspaceId;
  sessionId: SessionId | null;
  projectId: ProjectId | null;
  branch: string | null;
}>;

type Params = {
  readonly target: StartWorkTarget;
};

export const startWorkKeyOf = ({ target }: Params): string =>
  [
    target.workspaceId,
    target.sessionId ?? 'new',
    target.projectId ?? 'none',
    target.branch ?? 'new',
  ].join('|');
