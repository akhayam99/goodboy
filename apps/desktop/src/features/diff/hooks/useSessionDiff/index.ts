import {
  readWorktreeStatus,
  subscribe,
  worktreeStatusKey,
} from '../../../../store/runtime/worktreeStatuses/cache';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { parseUnifiedDiff } from '@goodboy/core/github';
import type { BranchCommit, DiffView, FileDiff, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore, useSummarizerStatus, type DiffFocus } from '../../../../store';
import {
  selectMountBaseBranch,
  selectMountForPath,
} from '../../../../store/slices/project-mounts/selectors';
import {
  listBranchCommits,
  worktreeDiff,
  worktreeDiffCommit,
  worktreeDiffWorking,
  worktreeStatus,
} from '../../../worktree/worktree';
import { worktreeDiffFiles } from '../../../worktree/worktreeDiffFiles';
import { orderLikeTree } from '../../lib/changeTree';
import { fileOfEntry } from '../../lib/fileOfEntry';
import { parseDiffAsync } from '../../lib/parseDiffAsync';
import { useDiffBodies } from '../useDiffBodies';
import {
  fileSignature,
  readReviewedMap,
  viewedStateOf,
  writeReviewedMap,
  type ReviewedMap,
} from '../../lib/reviewedFiles';
import type { DiffBodies, DiffViewed } from '../../components/DiffView/types';

const DEFAULT_VIEW: DiffView = { kind: 'branch' };
const NO_COMMITS: ReadonlyArray<BranchCommit> = [];

type MetaRead = {
  readonly key: string;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly status: WorktreeStatus | null;
};

type MetaFailure = {
  readonly key: string;
  readonly message: string;
};

type MetaKeyParams = {
  readonly worktreePath: string | null;
  readonly baseBranch: string | null;
};

const metaKeyOf = ({ worktreePath, baseBranch }: MetaKeyParams): string =>
  JSON.stringify([worktreePath, baseBranch]);

type LoadDiffParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
  readonly view: DiffView;
};

const loadDiffForView = ({ worktreePath, baseBranch, view }: LoadDiffParams): Promise<string> => {
  if (view.kind === 'working') {
    return worktreeDiffWorking(worktreePath, view.scope);
  }
  if (view.kind === 'commit') {
    return worktreeDiffCommit(worktreePath, view.sha);
  }
  return worktreeDiff({ worktreePath, baseBranch });
};

type Params = {
  readonly sessionId: SessionId | null;
  readonly worktreePath: string | null;
  readonly loader?: (() => Promise<string>) | null;
  readonly diffFocus?: DiffFocus | null;
  readonly branchRevision?: number | string;
};

export type DiffAlternate = {
  readonly view: DiffView;
  readonly fileCount: number;
};

const hasUncommittedWork = (status: WorktreeStatus): boolean =>
  status.workingTree.kind === 'known' &&
  status.workingTree.staged +
    status.workingTree.unstaged +
    status.workingTree.untracked +
    status.workingTree.unmerged >
    0;

const isCleanWithCommitsAhead = (status: WorktreeStatus): boolean =>
  status.workingTree.kind === 'known' &&
  !hasUncommittedWork(status) &&
  status.mainDistance.kind === 'known' &&
  status.mainDistance.ahead > 0;

type AlternateViewParams = {
  readonly view: DiffView;
  readonly status: WorktreeStatus | null;
};

const alternateViewOf = ({ view, status }: AlternateViewParams): DiffView | null => {
  if (status === null) {
    return null;
  }
  if (view.kind === 'working') {
    return status.mainDistance.kind === 'known' && status.mainDistance.ahead === 0
      ? null
      : DEFAULT_VIEW;
  }
  if (view.kind === 'branch') {
    return hasUncommittedWork(status) ? { kind: 'working', scope: 'all' } : null;
  }
  return null;
};

export type SessionDiff = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly patch: string;
  readonly loading: boolean;
  readonly isRefreshing: boolean;
  readonly bodies: DiffBodies | null;
  readonly error: string | null;
  readonly view: DiffView;
  readonly setView: (view: DiffView) => void;
  readonly alternate: DiffAlternate | null;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly status: WorktreeStatus | null;
  readonly metaError: string | null;
  readonly refresh: () => void;
  readonly viewed: DiffViewed;
  readonly focusPath: string | null;
  readonly focusThreadId: string | null;
  readonly clearFocus: () => void;
};

export const useSessionDiff = ({
  sessionId,
  worktreePath,
  loader = null,
  diffFocus = null,
  branchRevision = 0,
}: Params): SessionDiff => {
  const [parsedFiles, setParsedFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [entryFiles, setEntryFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [isLazy, setIsLazy] = useState(false);
  const [patch, setPatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadedSource = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<DiffView>(DEFAULT_VIEW);
  const [alternate, setAlternate] = useState<DiffAlternate | null>(null);
  const hasPickedView = useRef(false);
  const [meta, setMeta] = useState<MetaRead | null>(null);
  const [metaFailure, setMetaFailure] = useState<MetaFailure | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const [focusThreadId, setFocusThreadId] = useState<string | null>(null);
  const mountId = useAppStore((s) =>
    sessionId === null
      ? null
      : (selectMountForPath({ state: s, sessionId, path: worktreePath })?.mountId ?? null),
  );
  const [reviewedMap, setReviewedMap] = useState<ReviewedMap>(() =>
    readReviewedMap(sessionId, DEFAULT_VIEW, mountId),
  );
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);
  const summarizer = useSummarizerStatus(sessionId);
  const previousSummarizer = useRef(summarizer.status);
  const isGitAware = worktreePath !== null;
  const baseBranch = useAppStore((s) =>
    sessionId === null ? null : selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );

  const metaKey = metaKeyOf({ worktreePath, baseBranch });
  const isMetaCurrent = meta !== null && meta.key === metaKey;
  const commits = isMetaCurrent ? meta.commits : NO_COMMITS;
  const status = isMetaCurrent ? meta.status : null;
  const metaError =
    metaFailure !== null && metaFailure.key === metaKey ? metaFailure.message : null;

  const refresh = useCallback(() => setRefreshTick((tick) => tick + 1), []);
  const setView = useCallback((next: DiffView) => {
    hasPickedView.current = true;
    setViewState(next);
  }, []);
  const clearFocus = useCallback(() => {
    setFocusPath(null);
    setFocusThreadId(null);
  }, []);

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
    setViewState(
      diffFocus.kind === 'working'
        ? { kind: 'working', scope: 'all' }
        : diffFocus.kind === 'branch'
          ? DEFAULT_VIEW
          : { kind: 'commit', sha: diffFocus.sha },
    );
    setFocusPath(diffFocus.path);
    setFocusThreadId(diffFocus.kind === 'branch' ? (diffFocus.threadId ?? null) : null);
  }, [diffFocus]);

  useEffect(() => {
    if (hasPickedView.current || view.kind !== 'working' || status === null) {
      return;
    }
    if (isCleanWithCommitsAhead(status)) {
      setViewState(DEFAULT_VIEW);
    }
  }, [status, view]);

  useEffect(() => {
    if (worktreePath === null) {
      return;
    }
    let cancelled = false;
    const key = metaKeyOf({ worktreePath, baseBranch });
    Promise.all([
      listBranchCommits(worktreePath, baseBranch ?? null),
      worktreeStatus({ worktreePath, baseBranch }),
    ])
      .then(([nextCommits, nextStatus]) => {
        if (cancelled) {
          return;
        }
        setMeta({ key, commits: nextCommits, status: nextStatus });
        setMetaFailure(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMetaFailure({ key, message: formatError(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [worktreePath, baseBranch, refreshTick, branchRevision]);

  useEffect(() => {
    if (worktreePath === null) {
      return undefined;
    }
    const key = worktreeStatusKey({ worktreePath, baseBranch: baseBranch ?? undefined });
    return subscribe({
      key,
      listener: () => {
        const next = readWorktreeStatus(key);
        if (next !== null) {
          const metaTarget = metaKeyOf({ worktreePath, baseBranch });
          setMeta((previous) => ({
            key: metaTarget,
            commits:
              previous !== null && previous.key === metaTarget ? previous.commits : NO_COMMITS,
            status: next,
          }));
        }
      },
    });
  }, [worktreePath, baseBranch]);

  useEffect(() => {
    const fetcher =
      worktreePath !== null
        ? () => loadDiffForView({ worktreePath, baseBranch, view })
        : (loader ?? null);
    if (fetcher === null) {
      setError('no diff source configured');
      setLoading(false);
      return;
    }
    let cancelled = false;
    const source = JSON.stringify([worktreePath, baseBranch, view]);
    const isReload = loadedSource.current === source && loader === null;
    const canList = worktreePath !== null && view.kind === 'branch' && loader === null;
    let hasFullDiff = false;
    let isListed = false;
    setLoading(!isReload);
    setIsRefreshing(isReload);
    setError(null);
    if (!canList) {
      setIsLazy(false);
    }
    if (canList) {
      worktreeDiffFiles({ worktreePath, baseBranch })
        .then((entries) => {
          if (cancelled || hasFullDiff || !Array.isArray(entries) || entries.length === 0) {
            return;
          }
          isListed = true;
          loadedSource.current = source;
          setEntryFiles(orderLikeTree({ files: entries.map((entry) => fileOfEntry({ entry })) }));
          setIsLazy(true);
          setLoadedPath(worktreePath);
          setLoading(false);
          setIsRefreshing(false);
        })
        .catch(() => {
          isListed = false;
        });
    }
    fetcher()
      .then((raw) => {
        if (cancelled) {
          return;
        }
        hasFullDiff = true;
        setPatch(raw);
        if (isListed) {
          return;
        }
        loadedSource.current = source;
        return parseDiffAsync({ raw }).then((parsed) => {
          if (cancelled) {
            return;
          }
          setIsLazy(false);
          setParsedFiles(orderLikeTree({ files: parsed }));
          setLoadedPath(worktreePath);
          setLoading(false);
          setIsRefreshing(false);
        });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        hasFullDiff = true;
        if (isListed) {
          return;
        }
        setError(formatError(err));
        setLoadedPath(worktreePath);
        setLoading(false);
        setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [worktreePath, baseBranch, view, refreshTick, loader]);

  const baseFiles = isLazy ? entryFiles : parsedFiles;
  const sourceKey = useMemo(
    () => JSON.stringify([worktreePath, baseBranch, view]),
    [worktreePath, baseBranch, view],
  );
  const { files, bodies } = useDiffBodies({
    baseFiles,
    isLazy,
    worktreePath,
    baseBranch,
    sourceKey,
  });
  const isEmptyView = !loading && error === null && files.length === 0;

  useEffect(() => {
    const target = isEmptyView ? alternateViewOf({ view, status }) : null;
    if (worktreePath === null || target === null) {
      setAlternate(null);
      return;
    }
    let cancelled = false;
    loadDiffForView({ worktreePath, baseBranch, view: target })
      .then((raw) => {
        if (cancelled) {
          return;
        }
        const fileCount = parseUnifiedDiff(raw).length;
        setAlternate(fileCount === 0 ? null : { view: target, fileCount });
      })
      .catch(() => {
        if (!cancelled) {
          setAlternate(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isEmptyView, view, status, worktreePath, baseBranch]);

  useEffect(() => {
    setReviewedMap(readReviewedMap(sessionId, view, mountId));
  }, [sessionId, view, mountId, baseFiles]);

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
        writeReviewedMap(sessionId, view, updated, mountId);
        return updated;
      });
    },
    [sessionId, view, mountId],
  );

  const viewed = useMemo<DiffViewed>(
    () => ({ stateOf: (file) => viewedStateOf(file, reviewedMap), onToggle }),
    [onToggle, reviewedMap],
  );

  return {
    files,
    patch,
    loading: loading || (worktreePath !== null && loadedPath !== worktreePath),
    isRefreshing,
    bodies,
    error,
    view,
    setView,
    alternate,
    commits,
    status,
    metaError,
    refresh,
    viewed,
    focusPath,
    focusThreadId,
    clearFocus,
  };
};
