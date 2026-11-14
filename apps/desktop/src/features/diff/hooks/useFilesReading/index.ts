import { useCallback, useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ExploreEntry } from '../../../explore/explore';
import { useChangesMode, type ChangesMode } from '../useChangesMode';
import type { ReviewState } from '../useReviewState';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly review: ReviewState;
  readonly dismissTree: () => void;
};

type ExpandParams = {
  readonly path: string;
  readonly isExpanded: boolean;
};

type OpenEntry = {
  readonly worktreePath: string;
  readonly entry: ExploreEntry;
};

export type FilesReading = {
  readonly isAll: boolean;
  readonly openFile: ExploreEntry | null;
  readonly expanded: Readonly<Record<string, boolean>>;
  readonly selectMode: (mode: ChangesMode) => void;
  readonly setFolderExpanded: (params: ExpandParams) => void;
  readonly pickFile: (path: string) => void;
  readonly pickUnchanged: (entry: ExploreEntry) => void;
  readonly backToChanges: () => void;
};

const NO_EXPANDED: Readonly<Record<string, boolean>> = Object.freeze({});

export const useFilesReading = ({
  sessionId,
  worktreePath,
  review,
  dismissTree,
}: Params): FilesReading => {
  const { mode, setMode } = useChangesMode({ sessionId, mountPath: worktreePath });
  const isAll = mode === 'all';
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null);
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const openFile = isAll && openEntry?.worktreePath === worktreePath ? openEntry.entry : null;
  const isReading = openFile !== null;
  const expanded = useAppStore(
    (s) => s.exploreExpanded?.[sessionId]?.[worktreePath] ?? NO_EXPANDED,
  );
  const setExploreExpanded = useAppStore((s) => s.setExploreExpanded);

  useEffect(() => {
    if (isReading || pendingJump === null) {
      return;
    }
    review.jumpTo(pendingJump);
    setPendingJump(null);
  }, [isReading, pendingJump, review]);

  const selectMode = useCallback(
    (next: ChangesMode) => {
      setOpenEntry(null);
      setMode({ mode: next });
    },
    [setMode],
  );
  const setFolderExpanded = useCallback(
    ({ path, isExpanded }: ExpandParams) =>
      setExploreExpanded({ sessionId, mountPath: worktreePath, path, isExpanded }),
    [sessionId, setExploreExpanded, worktreePath],
  );
  const backToChanges = useCallback(() => setOpenEntry(null), []);
  const pickFile = useCallback(
    (path: string) => {
      if (isReading) {
        setOpenEntry(null);
        setPendingJump(path);
        dismissTree();
        return;
      }
      review.jumpTo(path);
      dismissTree();
    },
    [dismissTree, isReading, review],
  );
  const pickUnchanged = useCallback(
    (entry: ExploreEntry) => {
      setOpenEntry({ worktreePath, entry });
      dismissTree();
    },
    [dismissTree, worktreePath],
  );

  return {
    isAll,
    openFile,
    expanded,
    selectMode,
    setFolderExpanded,
    pickFile,
    pickUnchanged,
    backToChanges,
  };
};
