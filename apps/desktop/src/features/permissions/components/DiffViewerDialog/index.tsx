import { useEffect, useMemo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { CheckCircle2, FileEdit, X } from 'lucide-react';
import { Dialog, Divider, EmptyState, ScrollFade, Skeleton } from '@goodboy/ui';
import { parseUnifiedDiff } from '@goodboy/core';
import type {
  BranchCommit,
  DiffComment,
  DiffCommentAnchor,
  DiffView,
  FileDiff,
  AgentId,
  SessionId,
  WorktreeStatus,
} from '@goodboy/types';
import { ghPrDiff } from '../../../../features/github/github';
import { openFileInWorkspace } from '../../../../shared/lib/editor';
import { formatError } from '../../../../shared/lib/errors';
import {
  DEFAULT_EDITOR_BINARY,
  SETTING_DEFAULT_EDITOR,
  SETTING_EDITOR_BINARY,
} from '../../../../features/settings/settings';
import { useAppStore, useDiffComments, useSummarizerStatus } from '../../../../store';
import { AGENT_KIND_DEFAULTS } from '../../../../features/session/agent-kind';
import { STORAGE_KEYS, STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';
import {
  listBranchCommits,
  worktreeDiff,
  worktreeDiffCommit,
  worktreeDiffWorking,
  worktreeStatus,
} from '../../../../features/worktree/worktree';
import { DiffViewSelector } from '../DiffViewSelector';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { TOOLBAR_ICON_BTN, type ReviewState } from './lib';
import { FileRail } from './FileTree/FileRail';
import { FileDiffCard } from './FileDiffCard';
import { DiffToolbar } from './DiffToolbar';
import { NotesFooter } from './NotesFooter';

type DiffViewerContentProps = {
  onClose: () => void;
  sessionId?: SessionId;
  title?: string;
  loader?: () => Promise<string>;
  repoSlug?: string;
  prNumber?: number;
  cwd?: string;
  workingDir?: string;
  worktreePath?: string;
  jumpToFirstCommented?: boolean;
  jumpToFile?: string;
  showToolbarClose?: boolean;
};

type DiffViewerDialogProps = DiffViewerContentProps & {
  open: boolean;
};

type DiffViewerPaneProps = DiffViewerContentProps & {
  workspaceName: string;
};

const DEFAULT_VIEW: DiffView = { kind: 'branch' };

const DIFF_BATCH_SIZE = 20;

const DIFF_SKELETON_CARDS: ReadonlyArray<ReadonlyArray<string>> = [
  ['72%', '54%', '88%', '40%', '66%', '30%'],
  ['60%', '82%', '46%', '70%'],
];

const viewStorageKey = (sessionId: SessionId | undefined): string | null =>
  sessionId ? `${STORAGE_PREFIXES.diffView}${sessionId}` : null;

const readPersistedView = (sessionId: SessionId | undefined): DiffView | null => {
  const key = viewStorageKey(sessionId);
  if (!key || typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DiffView;
    if (parsed && typeof parsed === 'object' && 'kind' in parsed) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
};

const writePersistedView = (sessionId: SessionId | undefined, view: DiffView): void => {
  const key = viewStorageKey(sessionId);
  if (!key || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(view));
  } catch {
    // ignore
  }
};

const loadDiffForView = (worktreePath: string, view: DiffView): Promise<string> => {
  if (view.kind === 'working') {
    return worktreeDiffWorking(worktreePath, view.scope);
  }
  if (view.kind === 'commit') {
    return worktreeDiffCommit(worktreePath, view.sha);
  }
  return worktreeDiff(worktreePath);
};

const emptyStateLabel = (view: DiffView, isGitAware: boolean): string => {
  if (!isGitAware) {
    return 'No diff available';
  }
  if (view.kind === 'working') {
    if (view.scope === 'staged') {
      return 'No staged changes';
    }
    if (view.scope === 'unstaged') {
      return 'No unstaged changes';
    }
    return 'Working tree clean';
  }
  if (view.kind === 'commit') {
    return 'This commit is empty';
  }
  return 'Branch matches main';
};

const emptyStateBlurb = (view: DiffView, isGitAware: boolean): string | null => {
  if (!isGitAware) {
    return null;
  }
  if (view.kind === 'working') {
    if (view.scope === 'staged') {
      return 'Nothing has been staged for the next commit yet.';
    }
    if (view.scope === 'unstaged') {
      return 'No uncommitted edits in the working tree.';
    }
    return 'No uncommitted edits and nothing staged.';
  }
  if (view.kind === 'commit') {
    return 'No file changes were recorded for this commit.';
  }
  return 'Every commit on this branch is already reachable from main, nothing extra to review.';
};

const SIDEBAR_PREF_KEY = STORAGE_KEYS.diffSidebarCollapsed;

const buildNotesPrompt = (notes: ReadonlyArray<DiffComment>): string => {
  const byFile = new Map<string, DiffComment[]>();
  for (const n of notes) {
    const list = byFile.get(n.filePath) ?? [];
    list.push(n);
    byFile.set(n.filePath, list);
  }
  const sections: string[] = [];
  for (const [file, items] of byFile) {
    const lines = items.map((n) => {
      const anchor = n.anchor
        ? n.anchor.endLineNumber
          ? `[${n.anchor.side}:${n.anchor.lineNumber}-${n.anchor.endLineNumber}]`
          : `[${n.anchor.side}:${n.anchor.lineNumber}]`
        : '[file-level]';
      return `  - ${anchor} (id ${n.id}) ${n.body.replace(/\n+/g, ' ')}`;
    });
    sections.push(`### ${file}\n${lines.join('\n')}`);
  }
  const header = [
    'open review notes on these files. each note is anchored to a specific line of the diff.',
    '',
    '**mode: PROPOSE-ONLY**',
    '- do NOT modify any code.',
    '- for each note, produce: context, proposed fix (snippet), affected file/line.',
    '- end with a summary plan (note → fix) for me to approve.',
  ].join('\n');
  return `${header}\n\n${sections.join('\n\n')}`;
};

const readSidebarPref = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.localStorage.getItem(SIDEBAR_PREF_KEY) !== '0';
};

const writeSidebarPref = (collapsed: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? '1' : '0');
};

type ReviewedMap = Record<string, string>;

const viewKeyOf = (view: DiffView): string => {
  if (view.kind === 'commit') {
    return `commit:${view.sha}`;
  }
  if (view.kind === 'working') {
    return `working:${view.scope}`;
  }
  return 'branch';
};

const fileSignature = (f: FileDiff): string =>
  `${f.status}:${f.additions}:${f.deletions}:${f.hunks.length}:${f.hunks
    .map((h) => h.header)
    .join('§')}`;

const reviewedStorageKey = (sessionId: SessionId | undefined, view: DiffView): string | null =>
  sessionId ? `${STORAGE_PREFIXES.diffReviewed}${sessionId}:${viewKeyOf(view)}` : null;

const readReviewedMap = (sessionId: SessionId | undefined, view: DiffView): ReviewedMap => {
  const key = reviewedStorageKey(sessionId, view);
  if (!key || typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ReviewedMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeReviewedMap = (
  sessionId: SessionId | undefined,
  view: DiffView,
  map: ReviewedMap,
): void => {
  const key = reviewedStorageKey(sessionId, view);
  if (!key || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore
  }
};

const DiffViewerContent = ({
  onClose,
  sessionId,
  title,
  loader,
  repoSlug,
  prNumber,
  cwd,
  workingDir,
  worktreePath,
  jumpToFirstCommented = false,
  jumpToFile,
  showToolbarClose = true,
}: DiffViewerContentProps) => {
  const [files, setFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [mountedCount, setMountedCount] = useState(DIFF_BATCH_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPref);
  const [activePath, setActivePath] = useState<string | null>(null);
  const fileRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  const [view, setViewState] = useState<DiffView>(
    () => readPersistedView(sessionId) ?? DEFAULT_VIEW,
  );
  const [commits, setCommits] = useState<ReadonlyArray<BranchCommit>>([]);
  const [status, setStatus] = useState<WorktreeStatus | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const isGitAware = Boolean(worktreePath);

  const setView = useCallback(
    (next: DiffView) => {
      setViewState(next);
      writePersistedView(sessionId, next);
    },
    [sessionId],
  );

  const comments = useDiffComments(sessionId ?? null);
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);
  const addDiffComment = useAppStore((s) => s.addDiffComment);
  const resolveDiffComment = useAppStore((s) => s.resolveDiffComment);
  const consumeDiffComments = useAppStore((s) => s.consumeDiffComments);
  const reopenDiffComment = useAppStore((s) => s.reopenDiffComment);
  const deleteDiffComment = useAppStore((s) => s.deleteDiffComment);
  const summarizer = useSummarizerStatus(sessionId ?? null);
  const prevSummarizerStatus = useRef(summarizer.status);

  const editorBinary = useAppStore(
    (s) =>
      s.settings[SETTING_DEFAULT_EDITOR] ??
      s.settings[SETTING_EDITOR_BINARY] ??
      DEFAULT_EDITOR_BINARY,
  );
  const selectAgent = useAppStore((s) => s.selectAgent);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const sendTurn = useAppStore((s) => s.sendTurn);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const [spawning, setSpawning] = useState(false);

  useEffect(() => {
    if (
      isGitAware &&
      prevSummarizerStatus.current === 'running' &&
      summarizer.status !== 'running'
    ) {
      setRefreshTick((t) => t + 1);
    }
    prevSummarizerStatus.current = summarizer.status;
  }, [summarizer.status, isGitAware]);

  const phaseRuns = useAppStore((s) =>
    sessionId ? (s.sessionPhaseRuns[sessionId] ?? null) : null,
  );
  const agentNameById = useMemo(() => {
    const m = new Map<AgentId, string>();
    if (phaseRuns) {
      for (const r of phaseRuns) m.set(r.id, r.name);
    }
    return m;
  }, [phaseRuns]);

  const openCommentsByFile = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) {
      if (c.status !== 'open') {
        continue;
      }
      m.set(c.filePath, (m.get(c.filePath) ?? 0) + 1);
    }
    return m;
  }, [comments]);

  const commentsByFile = useMemo(() => {
    const m = new Map<string, DiffComment[]>();
    for (const c of comments) {
      const arr = m.get(c.filePath);
      if (arr) {
        arr.push(c);
      } else {
        m.set(c.filePath, [c]);
      }
    }
    return m;
  }, [comments]);

  const [reviewedMap, setReviewedMap] = useState<ReviewedMap>(() =>
    readReviewedMap(sessionId, view),
  );
  useEffect(() => {
    setReviewedMap(readReviewedMap(sessionId, view));
  }, [sessionId, view, files]);

  const reviewStateByPath = useMemo(() => {
    const m = new Map<string, ReviewState>();
    for (const f of files) {
      const saved = reviewedMap[f.path];
      m.set(f.path, !saved ? 'none' : saved === fileSignature(f) ? 'reviewed' : 'stale');
    }
    return m;
  }, [files, reviewedMap]);

  const reviewedCount = useMemo(() => {
    let n = 0;
    for (const s of reviewStateByPath.values()) {
      if (s === 'reviewed') {
        n += 1;
      }
    }
    return n;
  }, [reviewStateByPath]);

  const toggleReviewed = useCallback(
    (file: FileDiff, next: boolean) => {
      setReviewedMap((prev) => {
        const updated = { ...prev };
        if (next) {
          updated[file.path] = fileSignature(file);
        } else {
          delete updated[file.path];
        }
        writeReviewedMap(sessionId, view, updated);
        return updated;
      });
    },
    [sessionId, view],
  );

  useEffect(() => {
    setViewState(DEFAULT_VIEW);
  }, []);

  useEffect(() => {
    if (!worktreePath) {
      return;
    }
    let cancelled = false;
    Promise.all([listBranchCommits(worktreePath), worktreeStatus(worktreePath)])
      .then(([c, s]) => {
        if (cancelled) {
          return;
        }
        setCommits(c);
        setStatus(s);
      })
      .catch(() => {
        // best-effort; the diff effect surfaces hard errors
      });
    return () => {
      cancelled = true;
    };
  }, [worktreePath, refreshTick]);

  useEffect(() => {
    didInitialScroll.current = false;
  }, [view, refreshTick]);

  useLayoutEffect(() => {
    setMountedCount(DIFF_BATCH_SIZE);
  }, [files]);

  useEffect(() => {
    if (mountedCount >= files.length) {
      return;
    }
    const schedule = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : setTimeout;
    const cancel = typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback : clearTimeout;
    const id = schedule(() => {
      setMountedCount((prev) => Math.min(prev + DIFF_BATCH_SIZE, files.length));
    });
    return () => {
      cancel(id as number);
    };
  }, [mountedCount, files]);

  useEffect(() => {
    const fetcher = isGitAware
      ? () => loadDiffForView(worktreePath as string, view)
      : (loader ??
        (repoSlug !== undefined && prNumber !== undefined
          ? () => ghPrDiff(repoSlug, prNumber, cwd)
          : null));
    if (!fetcher) {
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
        setFiles(parseUnifiedDiff(raw));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(formatError(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isGitAware, worktreePath, view, refreshTick, loader, repoSlug, prNumber, cwd]);

  useEffect(() => {
    if (sessionId) {
      void loadDiffComments(sessionId);
    }
  }, [sessionId, loadDiffComments]);

  const scrollToFile = useCallback((path: string) => {
    fileRefs.current.get(path)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (files.length === 0 || didInitialScroll.current) {
      return;
    }
    let target: string | undefined;
    if (jumpToFile) {
      target = files.find((f) => f.path === jumpToFile || jumpToFile.endsWith(f.path))?.path;
    } else if (jumpToFirstCommented && openCommentsByFile.size > 0) {
      target = files.find((f) => openCommentsByFile.has(f.path))?.path;
    }
    if (target) {
      didInitialScroll.current = true;
      const path = target;
      requestAnimationFrame(() => scrollToFile(path));
    }
  }, [files, jumpToFile, jumpToFirstCommented, openCommentsByFile, scrollToFile]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || files.length === 0) {
      return;
    }
    // ScrollFade wraps the scroller in a positioned shell; the scroll viewport
    // is the descendant that actually overflows, and is the IO root.
    const viewport =
      scrollRef.current?.querySelector<HTMLElement>('.overflow-y-auto') ?? scrollRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const p = e.target.getAttribute('data-file-path');
            if (p) {
              setActivePath(p);
            }
          }
        }
      },
      { root: viewport, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    for (const el of fileRefs.current.values()) {
      obs.observe(el);
    }
    return () => obs.disconnect();
  }, [files]);

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      writeSidebarPref(next);
      return next;
    });
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'j' || e.key === 'k') {
        const idx = files.findIndex((f) => f.path === activePath);
        const cur = idx < 0 ? 0 : idx;
        const nextIdx = e.key === 'j' ? Math.min(cur + 1, files.length - 1) : Math.max(cur - 1, 0);
        const t = files[nextIdx];
        if (t) {
          scrollToFile(t.path);
        }
      }
    },
    [files, activePath, onClose, scrollToFile],
  );

  const openComments = useMemo(() => comments.filter((c) => c.status === 'open'), [comments]);

  const handleProposeFixes = async () => {
    if (!sessionId || openComments.length === 0 || spawning) {
      return;
    }
    setSpawning(true);
    try {
      const prompt = buildNotesPrompt(openComments);
      const defaults = AGENT_KIND_DEFAULTS.resolver;
      const fileCount = new Set(openComments.map((c) => c.filePath)).size;
      const name = `resolve notes (${fileCount}F/${openComments.length}N)`;
      const idsToConsume = openComments.map((c) => c.id);
      const agentId = await spawnAgent(sessionId, {
        name,
        model: defaults.model,
        effort: defaults.effort,
        kindOverride: 'resolver',
      });
      try {
        await consumeDiffComments(sessionId, idsToConsume, agentId);
      } catch (err) {
        console.error('failed to mark comments consumed', err);
      }
      void sendTurn({ sessionId, content: prompt });
      onClose();
    } finally {
      setSpawning(false);
    }
  };

  const handleViewAgent = async (agentId: AgentId) => {
    if (!sessionId) {
      return;
    }
    setActiveLens(sessionId, 'resolve');
    await selectAgent(sessionId, agentId);
    onClose();
  };

  const handleOpenInEditor = useCallback(
    async (filePath: string) => {
      if (!workingDir) {
        return;
      }
      const root = workingDir.replace(/\/$/, '');
      try {
        await openFileInWorkspace(root, `${root}/${filePath}`, editorBinary);
      } catch {
        // swallow, error surfaced via console
      }
    },
    [workingDir, editorBinary],
  );

  const handleAddComment = async (filePath: string, anchor: DiffCommentAnchor, body: string) => {
    if (!sessionId) {
      return;
    }
    await addDiffComment(sessionId, filePath, body, anchor);
  };

  const handleAddFileLevelComment = async (filePath: string, body: string) => {
    if (!sessionId) {
      return;
    }
    await addDiffComment(sessionId, filePath, body);
  };

  const registerFileRef = useCallback(
    (path: string) => (el: HTMLElement | null) => {
      if (el) {
        fileRefs.current.set(path, el);
      } else {
        fileRefs.current.delete(path);
      }
    },
    [],
  );

  const isEmpty = !loading && !error && files.length === 0;

  return (
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- container handles keyboard nav */
    <div className="flex h-full min-h-0 w-full flex-col" onKeyDown={handleKeyDown}>
      {isEmpty ? (
        isGitAware ? (
          <>
            <div className="flex shrink-0 items-center gap-2 px-2.5 py-1.5">
              <div className="flex min-w-0 flex-1 items-center">
                <DiffViewSelector
                  view={view}
                  onChange={setView}
                  commits={commits}
                  status={status}
                  filesCount={loading ? null : files.length}
                  loading={loading}
                />
              </div>
              {showToolbarClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  title="close"
                  aria-label="close"
                  className={TOOLBAR_ICON_BTN}
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
            <Divider className="shrink-0" />
          </>
        ) : showToolbarClose ? (
          <>
            <div className="flex shrink-0 items-center justify-end px-2.5 py-1.5">
              <button
                type="button"
                onClick={onClose}
                title="close"
                aria-label="close"
                className={TOOLBAR_ICON_BTN}
              >
                <X size={13} />
              </button>
            </div>
            <Divider className="shrink-0" />
          </>
        ) : null
      ) : (
        <DiffToolbar
          title={title}
          prNumber={prNumber}
          openCommentsCount={comments.filter((c) => c.status === 'open').length}
          reviewedCount={files.length > 0 ? reviewedCount : null}
          filesCount={files.length}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          status={isGitAware ? status : null}
          onRefresh={isGitAware ? () => setRefreshTick((t) => t + 1) : undefined}
          refreshing={loading}
          showClose={showToolbarClose}
          onClose={onClose}
          viewSelector={
            isGitAware ? (
              <DiffViewSelector
                view={view}
                onChange={setView}
                commits={commits}
                status={status}
                filesCount={loading ? null : files.length}
                loading={loading}
              />
            ) : null
          }
        />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4" aria-label="Loading diff">
            {DIFF_SKELETON_CARDS.map((lines, ci) => (
              <div
                key={ci}
                className="flex flex-col overflow-hidden rounded-md border border-border-soft"
              >
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Skeleton className="h-3 w-40 rounded" />
                  <div className="flex-1" />
                  <Skeleton className="h-3 w-10 rounded" />
                </div>
                <Divider />
                <div className="flex flex-col gap-1.5 p-3">
                  {lines.map((w, li) => (
                    <div key={li} className="flex items-center gap-3">
                      <Skeleton className="h-3 w-8 shrink-0 rounded" />
                      <Skeleton className="h-3 rounded" style={{ width: w }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center text-xs text-danger">{error}</div>
        ) : files.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              bordered
              tone="success"
              icon={CheckCircle2}
              title={emptyStateLabel(view, isGitAware)}
              description={emptyStateBlurb(view, isGitAware) ?? undefined}
            />
          </div>
        ) : (
          <>
            {!sidebarCollapsed && (
              <FileRail
                files={files}
                activePath={activePath}
                onSelect={scrollToFile}
                reviewStateByPath={reviewStateByPath}
                commentCounts={openCommentsByFile}
              />
            )}
            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col">
              <ScrollFade className="min-h-0 flex-1">
                {files.slice(0, mountedCount).map((file) => (
                  <FileDiffCard
                    key={file.path}
                    file={file}
                    registerRef={registerFileRef(file.path)}
                    reviewState={reviewStateByPath.get(file.path) ?? 'none'}
                    onToggleReviewed={(next) => toggleReviewed(file, next)}
                    canOpenEditor={Boolean(workingDir)}
                    onOpenInEditor={() => void handleOpenInEditor(file.path)}
                    comments={commentsByFile.get(file.path) ?? []}
                    canComment={Boolean(sessionId)}
                    onAddComment={(anchor, body) => void handleAddComment(file.path, anchor, body)}
                    onAddFileLevelComment={(body) =>
                      void handleAddFileLevelComment(file.path, body)
                    }
                    onResolve={(id) => sessionId && void resolveDiffComment(sessionId, id)}
                    onReopen={(id) => sessionId && void reopenDiffComment(sessionId, id)}
                    onDelete={(id) => sessionId && void deleteDiffComment(sessionId, id)}
                    onViewAgent={(id) => void handleViewAgent(id)}
                    getAgentName={(id) => agentNameById.get(id)}
                  />
                ))}
                {mountedCount < files.length && (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                    <span className="h-3 w-3 animate-spin rounded-full border border-muted-foreground/30 border-t-muted-foreground" />
                    {mountedCount} / {files.length} files
                  </div>
                )}
              </ScrollFade>
            </div>
          </>
        )}
      </div>

      {sessionId && openComments.length > 0 ? (
        <NotesFooter
          openCount={openComments.length}
          spawning={spawning}
          onPropose={() => void handleProposeFixes()}
        />
      ) : null}
    </div>
  );
};

export const DiffViewerDialog = ({ open, ...rest }: DiffViewerDialogProps) => (
  <Dialog
    open={open}
    onClose={rest.onClose}
    size="xl"
    fixedHeightClass="h-[92vh] max-w-[1400px]"
    className="w-[92vw] max-w-[1400px]"
    showClose={false}
    bodyClassName=""
  >
    {open ? <DiffViewerContent {...rest} /> : null}
  </Dialog>
);

export const DiffViewerPane = ({ workspaceName, onClose, ...rest }: DiffViewerPaneProps) => (
  <StudioShell
    icon={FileEdit}
    title="Diff"
    workspaceName={workspaceName}
    closeLabel="back to overview"
    onClose={onClose}
    variant="slot"
  >
    {(requestClose) => (
      <DiffViewerContent {...rest} onClose={requestClose} showToolbarClose={false} />
    )}
  </StudioShell>
);
