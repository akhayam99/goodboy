import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import type { DiffComments, DiffViewed } from '../../components/DiffView/types';
import { ancestorIds, buildChangeTree, type ChangeTree } from '../../lib/changeTree';
import type { SessionDiff } from '../useSessionDiff';
import { useDiffNotes } from '../useDiffNotes';
import { useDiffReviewThreads } from '../useDiffReviewThreads';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly diff: SessionDiff;
};

export type ReviewState = {
  readonly tree: ChangeTree;
  readonly comments: DiffComments;
  readonly viewed: DiffViewed;
  readonly noteCountOf: (path: string) => number;
  readonly activePath: string | null;
  readonly setActivePath: (path: string) => void;
  readonly collapsed: ReadonlySet<string>;
  readonly toggleFolder: (id: string) => void;
  readonly jumpTo: (path: string) => void;
};

const NO_FOLDERS_COLLAPSED: ReadonlySet<string> = new Set();

export const useReviewState = ({ sessionId, worktreePath, diff }: Params): ReviewState => {
  const { comments: noteComments } = useDiffNotes({ sessionId });
  const mountId = useAppStore(
    (s) => selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountId ?? null,
  );
  const reviewThreads = useDiffReviewThreads({ sessionId, mountId });
  const comments = useMemo(
    () =>
      reviewThreads.length === 0
        ? noteComments
        : { ...noteComments, threads: [...noteComments.threads, ...reviewThreads] },
    [noteComments, reviewThreads],
  );
  const tree = useMemo(() => buildChangeTree({ files: diff.files }), [diff.files]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(NO_FOLDERS_COLLAPSED);
  const rowsRef = useRef(tree.rows);
  rowsRef.current = tree.rows;
  const { focusFile } = diff;

  const noteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of comments.threads) {
      if (!thread.isResolved) {
        counts.set(thread.filePath, (counts.get(thread.filePath) ?? 0) + 1);
      }
    }
    return counts;
  }, [comments.threads]);
  const noteCountOf = useCallback((path: string) => noteCounts.get(path) ?? 0, [noteCounts]);

  const reveal = useCallback((path: string) => {
    const ancestors = ancestorIds({ rows: rowsRef.current, path });
    setCollapsed((current) => {
      if (!ancestors.some((id) => current.has(id))) {
        return current;
      }
      const next = new Set(current);
      for (const id of ancestors) {
        next.delete(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (activePath !== null) {
      reveal(activePath);
    }
  }, [activePath, reveal]);

  const toggleFolder = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const jumpTo = useCallback(
    (path: string) => {
      setActivePath(path);
      reveal(path);
      focusFile(path);
    },
    [focusFile, reveal],
  );

  return {
    tree,
    comments,
    viewed: diff.viewed,
    noteCountOf,
    activePath,
    setActivePath,
    collapsed,
    toggleFolder,
    jumpTo,
  };
};
