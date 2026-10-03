import { useEffect, useMemo } from 'react';
import type { DeletedBranch, WorkspaceId } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../store';
import type { BranchScope } from '../branches/branchScopeOf';

type Params = {
  readonly scope: BranchScope;
};

const LIST_SEPARATOR = '|';

export const useRecentlyDeletedBranches = ({ scope }: Params): ReadonlyArray<DeletedBranch> => {
  const workspaces = useWorkspaces();
  const deletedBranches = useAppStore((state) => state.deletedBranches);
  const loadDeletedBranches = useAppStore((state) => state.loadDeletedBranches);
  const reportError = useAppStore((state) => state.reportError);
  const workspaceKey =
    scope.kind === 'workspace'
      ? scope.id
      : workspaces.map((workspace) => workspace.id).join(LIST_SEPARATOR);

  useEffect(() => {
    const ids = workspaceKey === '' ? [] : (workspaceKey.split(LIST_SEPARATOR) as WorkspaceId[]);
    for (const workspaceId of ids) {
      void loadDeletedBranches({ workspaceId }).catch((error: unknown) =>
        reportError({ title: "Couldn't read the deleted branches", error }),
      );
    }
  }, [workspaceKey, loadDeletedBranches, reportError]);

  return useMemo(() => {
    const ids = workspaceKey === '' ? [] : (workspaceKey.split(LIST_SEPARATOR) as WorkspaceId[]);
    return ids
      .flatMap((workspaceId) => deletedBranches[workspaceId] ?? [])
      .filter((entry) => entry.restoredAt === null)
      .sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
  }, [deletedBranches, workspaceKey]);
};
