import type { Workspace, WorkspaceId } from '@goodboy/types';

type Params = {
  readonly workspace: Workspace | null;
  readonly mountWorkspaceId?: WorkspaceId;
};

export const workspaceMountName = ({ workspace, mountWorkspaceId }: Params): string | null => {
  if (workspace?.kind !== 'composite' || mountWorkspaceId == null) {
    return null;
  }
  return (
    (workspace.members ?? []).find((member) => member.workspaceId === mountWorkspaceId)
      ?.mountName ?? null
  );
};
