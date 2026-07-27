import type { WorkspaceKind } from '@goodboy/types';

type Params = {
  readonly workspaceKind?: WorkspaceKind | undefined;
  readonly branch?: string | null | undefined;
};

export const isBranchlessSession = ({ workspaceKind, branch }: Params): boolean => {
  if (workspaceKind === 'simple') {
    return true;
  }
  return branch != null && branch.trim() === '';
};
