import { RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { branchScopeOf } from '../../branches/branchScopeOf';
import { resolveStorageScope } from '../../resolveStorageScope';
import { storageOwnerMatchesScope } from '../../storageOwnerMatchesScope';
import { StorageScopePicker } from '../StoragePage/StorageScopePicker';

export const BranchesHeaderActions = () => {
  const storedScope = useAppStore((state) => state.storageScope);
  const currentWorkspaceId = useAppStore((state) => state.currentWorkspaceId);
  const setStorageScope = useAppStore((state) => state.setStorageScope);
  const scope = branchScopeOf({ scope: resolveStorageScope({ storedScope, currentWorkspaceId }) });
  const projectIds = useAppStore(
    useShallow((state) =>
      state.projects
        .filter(
          (project) =>
            project.kind === 'repo' &&
            project.disconnectedAt === undefined &&
            storageOwnerMatchesScope({ ownerWorkspace: project.workspaceId, scope }),
        )
        .map((project) => project.id),
    ),
  );
  const isLoading = useAppStore((state) =>
    projectIds.some((id) => state.branchScans[id]?.status === 'loading'),
  );
  const loadProjectBranches = useAppStore((state) => state.loadProjectBranches);
  const reportError = useAppStore((state) => state.reportError);
  const onCheck = () =>
    void loadProjectBranches({ projectIds }).catch((error: unknown) =>
      reportError({ title: "Couldn't read the branches", error }),
    );
  return (
    <>
      <StorageScopePicker scope={scope} hasRemoved={false} onChange={setStorageScope} />
      <Button variant="ghost" size="sm" onClick={onCheck} isBusy={isLoading} busyLabel="Checking">
        <RefreshCw size={ICON_SIZE.row} aria-hidden />
        Check again
      </Button>
    </>
  );
};
