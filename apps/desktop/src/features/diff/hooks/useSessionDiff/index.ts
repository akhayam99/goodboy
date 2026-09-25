import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { parseUnifiedDiff } from '@goodboy/core';
import type { BranchCommit, DiffView, FileDiff, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore, useSummarizerStatus, type DiffFocus } from '../../../../store';
import {
  listBranchCommits,
  worktreeDiff,
  worktreeDiffCommit,
  worktreeDiffWorking,
  worktreeStatus,
} from '../../../worktree/worktree';
import {
  fileSignature,
  readReviewedMap,
  viewedStateOf,
  writeReviewedMap,
  type ReviewedMap,
} from '../../lib/reviewedFiles';
import type { DiffViewed } from '../../components/DiffView/types';

const DEFAULT_VIEW: DiffView = { kind: 'branch' };

const loadDiffForView = (worktreePath: string, view: DiffView): Promise<string> => {
  if (view.kind === 'working') {
    return worktreeDiffWorking(worktreePath, view.scope);
  }
  if (view.kind === 'commit') {
    return worktreeDiffCommit(worktreePath, view.sha);
  }
  return worktreeDiff({ worktreePath });
};

type Params = {
  readonly sessionId: SessionId | null;
  readonly worktreePath: string | null;
  readonly loader?: (() => Promise<string>) | null;
  readonly diffFocus?: DiffFocus | null;
  readonly branchRevision?: number;
};

export type SessionDiff = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly patch: string;
  readonly loading: boolean;
  readonly error: string | null;
  readonly view: DiffView;
  readonly setView: (view: DiffView) => void;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly status: WorktreeStatus | null;
  readonly metaError: string | null;
  readonly refresh: () => void;
  readonly viewed: DiffViewed;
  readonly focusPath: string | null;
  readonly clearFocus: () => void;
};

export const useSessionDiff = ({
  sessionId,
  worktreePath,
  loader = null,
  diffFocus = null,
  branchRevision = 0,
}: Params): SessionDiff => {
  const [files, setFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [patch, setPatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<DiffView>(DEFAULT_VIEW);
  const [commits, setCommits] = useState<ReadonlyArray<BranchCommit>>([]);
  const [status, setStatus] = useState<WorktreeStatus | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const [reviewedMap, setReviewedMap] = useState<ReviewedMap>(() =>
    readReviewedMap(sessionId, DEFAULT_VIEW),
  );
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);
  const summarizer = useSummarizerStatus(sessionId);
  const previousSummarizer = useRef(summarizer.status);
  const isGitAware = worktreePath !== null;

  const refresh = useCallback(() => setRefreshTick((tick) => tick + 1), []);
  const clearFocus = useCallback(() => setFocusPath(null), []);

  useEffect(() => {
    if (isGitAware && previousSummarizer.current === 'running' && summarizer.status !== 'running') {
      refresh();
    }
    previousSummarizer.current = summarizer.status;
  }, [isGitAware, refresh, summarizer.status]);

  useEffect(() => {
    if (diffFocus == null) {
      return;
    }
    setView(
      diffFocus.kind === 'working'
        ? { kind: 'working', scope: 'all' }
        : diffFocus.kind === 'branch'
          ? DEFAULT_VIEW
          : { kind: 'commit', sha: diffFocus.sha },
    );
    setFocusPath(diffFocus.path);
  }, [diffFocus]);

  useEffect(() => {
    if (worktreePath === null) {
      return;
    }
    let cancelled = false;
    Promise.all([listBranchCommits(worktreePath), worktreeStatus({ worktreePath })])
      .then(([nextCommits, nextStatus]) => {
        if (cancelled) {
          return;
        }
        setCommits(nextCommits);
        setStatus(nextStatus);
        setMetaError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMetaError(formatError(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [worktreePath, refreshTick, branchRevision]);

  useEffect(() => {
    const fetcher =
      worktreePath !== null ? () => loadDiffForView(worktreePath, view) : (loader ?? null);
    if (fetcher === null) {
      setError('no diff source configured');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((raw) => {
        if (cancelled) {
          return;
        }
        setPatch(raw);
        setFiles(parseUnifiedDiff(raw));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(formatError(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [worktreePath, view, refreshTick, loader]);

  useEffect(() => {
    setReviewedMap(readReviewedMap(sessionId, view));
  }, [sessionId, view, files]);

  useEffect(() => {
    if (sessionId !== null) {
      void loadDiffComments(sessionId);
    }
  }, [loadDiffComments, sessionId]);

  const onToggle = useCallback(
    (file: FileDiff, next: boolean) => {
      setReviewedMap((previous) => {
        const updated: Record<string, string> = { ...previous };
        delete updated[file.path];
        if (next) {
          updated[file.path] = fileSignature(file);
        }
        writeReviewedMap(sessionId, view, updated);
        return updated;
      });
    },
    [sessionId, view],
  );

  const viewed = useMemo<DiffViewed>(
    () => ({ stateOf: (file) => viewedStateOf(file, reviewedMap), onToggle }),
    [onToggle, reviewedMap],
  );

  return {
    files,
    patch,
    loading,
    error,
    view,
    setView,
    commits,
    status,
    metaError,
    refresh,
    viewed,
    focusPath,
    clearFocus,
  };
};
