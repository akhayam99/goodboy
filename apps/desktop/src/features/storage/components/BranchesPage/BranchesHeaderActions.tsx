import { RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const BranchesHeaderActions = ({ workspaceId }: Props) => {
  const projectIds = useAppStore(
    useShallow((state) =>
      state.projects
        .filter(
          (project) =>
            project.kind === 'repo' &&
            project.disconnectedAt === undefined &&
            project.workspaceId === workspaceId,
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
    <Button variant="ghost" size="sm" onClick={onCheck} isBusy={isLoading} busyLabel="Checking">
      <RefreshCw size={ICON_SIZE.row} aria-hidden />
      Check again
    </Button>
  );
};
