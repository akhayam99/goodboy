import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { RefreshCw } from '@goodboy/ui/icons';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { StorageScope } from '../../../../store/slices/storage/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { useBranchProjects } from '../../hooks/useBranchProjects';

type Props = {
  readonly scope: StorageScope;
};

export const StorageCheckAgain = ({ scope }: Props) => {
  const checkedAt = useAppStore((state) => state.storageStats?.checkedAt ?? null);
  const projectIds = useBranchProjects({ scope }).map((project) => project.id);
  const isLoading = useAppStore(
    (state) =>
      state.storageStatsLoading ||
      projectIds.some((id) => state.branchScans[id]?.status === 'loading'),
  );
  const now = useNow(30_000);
  const loadStorage = useAppStore((state) => state.loadStorage);
  const loadProjectBranches = useAppStore((state) => state.loadProjectBranches);
  const reportError = useAppStore((state) => state.reportError);
  const onCheck = () => {
    void loadStorage({ isForced: true }).catch((error: unknown) =>
      reportError({ recovery: READ_FAILED, title: "Couldn't read storage usage", error }),
    );
    if (projectIds.length === 0) {
      return;
    }
    void loadProjectBranches({ projectIds }).catch((error: unknown) =>
      reportError({ recovery: READ_FAILED, title: "Couldn't read the branches", error }),
    );
  };
  return (
    <span className="flex items-center gap-2 text-meta text-faint-foreground">
      {checkedAt === null ? null : <span>Checked {formatAge({ from: checkedAt, now })}</span>}
      <Button variant="ghost" size="sm" onClick={onCheck} isBusy={isLoading} busyLabel="Checking">
        <RefreshCw size={ICON_SIZE.row} aria-hidden />
        Check again
      </Button>
    </span>
  );
};
