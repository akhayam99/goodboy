import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AppState } from '../../../../store/types';
import { currentStack, stackKey } from '../../../../store/slices/navigation/currentStack';
import { PLACE_ROWS } from '../../../../store/slices/navigation/placeRows';
import type { ExploreEntry } from '../../../explore/explore';
import { useChangesMode, type ChangesMode } from '../useChangesMode';
import type { ReviewState } from '../useReviewState';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly review: Pick<ReviewState, 'allFiles' | 'jumpTo'>;
  readonly dismissTree: () => void;
};

type ExpandParams = {
  readonly path: string;
  readonly isExpanded: boolean;
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

type SavedParams = {
  readonly state: AppState;
  readonly worktreePath: string;
};

type PathParams = {
  readonly relPath: string;
};

type WriteParams = {
  readonly worktreePath: string;
  readonly relPath: string | null;
};

const NO_EXPANDED: Readonly<Record<string, boolean>> = Object.freeze({});

const FILE_ROWS: ReadonlySet<string> = new Set([PLACE_ROWS.filesOpen, PLACE_ROWS.filesMount]);

const savedFileOf = ({ state, worktreePath }: SavedParams): string | null => {
  const stack = state.navigation[stackKey(state)];
  const rows = stack?.entries[stack.index]?.focus.returnRows;
  if (rows?.[PLACE_ROWS.filesMount] !== worktreePath) {
    return null;
  }
  return rows[PLACE_ROWS.filesOpen] ?? null;
};

const readerEntryOf = ({ relPath }: PathParams): ExploreEntry => ({
  name: relPath.split('/').at(-1) ?? relPath,
  relPath,
  isDir: false,
  sizeBytes: null,
  modifiedAt: null,
});

const writeSavedFile = ({ worktreePath, relPath }: WriteParams): void => {
  const state = useAppStore.getState();
  const stack = currentStack(state);
  const kept = stack.entries[stack.index]?.focus.returnRows ?? {};
  const rest = Object.fromEntries(Object.entries(kept).filter(([key]) => !FILE_ROWS.has(key)));
  const returnRows =
    relPath === null
      ? rest
      : {
          ...rest,
          [PLACE_ROWS.changesMode]: 'all',
          [PLACE_ROWS.filesOpen]: relPath,
          [PLACE_ROWS.filesMount]: worktreePath,
        };
  state.amendFocus({ patch: { returnRows } });
};

export const useFilesReading = ({
  sessionId,
  worktreePath,
  review,
  dismissTree,
}: Params): FilesReading => {
  const { mode, setMode } = useChangesMode({ sessionId, mountPath: worktreePath });
  const isAll = mode === 'all';
  const savedPath = useAppStore((state) => savedFileOf({ state, worktreePath }));
  const isSavedChanged =
    savedPath !== null && review.allFiles.some((file) => file.path === savedPath);
  const savedEntry = useMemo(
    () => (savedPath === null ? null : readerEntryOf({ relPath: savedPath })),
    [savedPath],
  );
  const openFile = isAll && !isSavedChanged ? savedEntry : null;
  const [pendingJump, setPendingJump] = useState<string | null>(null);
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
      writeSavedFile({ worktreePath, relPath: null });
      setMode({ mode: next });
    },
    [setMode, worktreePath],
  );
  const setFolderExpanded = useCallback(
    ({ path, isExpanded }: ExpandParams) =>
      setExploreExpanded({ sessionId, mountPath: worktreePath, path, isExpanded }),
    [sessionId, setExploreExpanded, worktreePath],
  );
  const backToChanges = useCallback(
    () => writeSavedFile({ worktreePath, relPath: null }),
    [worktreePath],
  );
  const pickFile = useCallback(
    (path: string) => {
      if (isReading) {
        writeSavedFile({ worktreePath, relPath: null });
        setPendingJump(path);
        dismissTree();
        return;
      }
      review.jumpTo(path);
      dismissTree();
    },
    [dismissTree, isReading, review, worktreePath],
  );
  const pickUnchanged = useCallback(
    (entry: ExploreEntry) => {
      writeSavedFile({ worktreePath, relPath: entry.relPath });
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
