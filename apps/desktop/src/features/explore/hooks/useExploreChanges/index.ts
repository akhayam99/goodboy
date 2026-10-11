import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { loadMountChangedFiles } from '../../../../store/slices/project-mounts/loadMountChangedFiles';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { useMountDiffRevision } from '../../../../store/slices/project-mounts/useMountDiffRevision';
import type { ChangedEntry } from '../../../worktree/worktree';
import { buildExploreChanges, NO_EXPLORE_CHANGES, type ExploreChanges } from '../../exploreChanges';

type Params = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

type Loaded = {
  readonly mountPath: string;
  readonly entries: ReadonlyArray<ChangedEntry>;
};

export type ExploreChangesView = {
  readonly changes: ExploreChanges;
  readonly baseBranch: string | null;
  readonly isAvailable: boolean;
  readonly refresh: () => void;
};

export const useExploreChanges = ({ sessionId, mountPath }: Params): ExploreChangesView => {
  const baseBranch = useAppStore((state) =>
    mountPath === null ? null : selectMountBaseBranch({ state, sessionId, path: mountPath }),
  );
  const tickRevision = useMountDiffRevision(sessionId);
  const [refreshes, setRefreshes] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const revision = refreshes === 0 ? tickRevision : `${tickRevision}|refresh-${refreshes}`;

  useEffect(() => {
    if (mountPath === null || mountPath.trim() === '') {
      return;
    }
    let isCancelled = false;
    void loadMountChangedFiles({ worktreePath: mountPath, baseBranch, revision }).then(
      (summary) => {
        if (isCancelled || summary === null) {
          return;
        }
        setLoaded({ mountPath, entries: summary.entries });
      },
    );
    return () => {
      isCancelled = true;
    };
  }, [mountPath, baseBranch, revision]);

  const entries = loaded !== null && loaded.mountPath === mountPath ? loaded.entries : null;
  const changes = useMemo(
    () => (entries === null ? NO_EXPLORE_CHANGES : buildExploreChanges({ entries })),
    [entries],
  );
  const refresh = useCallback(() => setRefreshes((count) => count + 1), []);

  return { changes, baseBranch, isAvailable: entries !== null, refresh };
};
