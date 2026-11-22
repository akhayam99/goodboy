import { useCallback, useEffect, useMemo } from 'react';
import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { useAppStore } from '../../../../store';
import { tracksOfWorkspace, type ProjectWorktrees } from '../../../track/tracksOfWorkspace';
import { worktreesChannel } from '../../worktreesChannel';
import { useStorageSummary } from '../useStorageSummary';

type Params = {
  readonly repoRoot: string;
  readonly isOpen: boolean;
};

export type ProjectWorktreesView = ProjectWorktrees &
  Readonly<{
    measuringPath: string | null;
  }>;

export const useProjectWorktrees = ({ repoRoot, isOpen }: Params): ProjectWorktreesView => {
  const folders = useAppStore((state) => state.storageFolders);
  const measuringPath = useAppStore((state) => state.storageMeasuringPath);
  const loadStorage = useAppStore((state) => state.loadStorage);
  const measureStorageSizes = useAppStore((state) => state.measureStorageSizes);
  const reportError = useAppStore((state) => state.reportError);
  const { terminals } = useStorageSummary();

  const worktrees = useMemo(
    () => tracksOfWorkspace({ folders, repoRoot, terminals }),
    [folders, repoRoot, terminals],
  );

  const refresh = useCallback(async () => {
    try {
      await loadStorage();
      const paths = useAppStore
        .getState()
        .storageFolders.filter((folder) => folder.repoRoot === repoRoot)
        .map((folder) => folder.path);
      await measureStorageSizes({ paths });
    } catch (error) {
      await reportError({ recovery: READ_FAILED, title: "Couldn't read the worktrees", error });
    }
  }, [loadStorage, measureStorageSizes, repoRoot, reportError]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void refresh();
    let isLive = true;
    let unlisten: (() => void) | null = null;
    worktreesChannel
      .listen({
        onChange: ({ repoRoots }) => {
          if (repoRoots.includes(repoRoot)) {
            void refresh();
          }
        },
      })
      .then((stop) => {
        if (!isLive) {
          stop();
          return;
        }
        unlisten = stop;
      })
      .catch((error: unknown) =>
        reportError({ recovery: READ_FAILED, title: "Couldn't follow the other windows", error }),
      );
    return () => {
      isLive = false;
      unlisten?.();
    };
  }, [isOpen, refresh, repoRoot, reportError]);

  return { ...worktrees, measuringPath };
};
