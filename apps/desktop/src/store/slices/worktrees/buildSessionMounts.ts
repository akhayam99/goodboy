import type { SessionWorktree } from '@goodboy/db';
import type { SessionMount, Workspace } from '@goodboy/types';

type Params = {
  readonly workspace: Workspace | null;
  readonly rows: ReadonlyArray<SessionWorktree>;
};

export const buildSessionMounts = ({ workspace, rows }: Params): ReadonlyArray<SessionMount> => {
  if (workspace?.kind !== 'composite') {
    return [];
  }
  return rows.flatMap((row) => {
    if (row.mountWorkspaceId == null) {
      return [];
    }
    const member = workspace.members?.find(
      (candidate) => candidate.workspaceId === row.mountWorkspaceId,
    );
    if (member == null) {
      return [];
    }
    return [
      {
        workspaceId: row.mountWorkspaceId,
        mountName: row.mountName ?? member.mountName,
        worktreePath: row.worktreePath,
        repoRoot: member.rootPath,
        branch: row.branch,
      },
    ];
  });
};
