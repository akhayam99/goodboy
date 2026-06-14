import { Fragment, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronsDown,
  Copy,
  ExternalLink,
  FileEdit,
  GitBranch,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Dialog, ScrollArea, Textarea, cn } from '@goodboy/ui';
import { useToast } from '../../../../app/components/Toast';
import { parseUnifiedDiff } from '@goodboy/core';
import type {
  BranchCommit,
  DiffComment,
  DiffCommentAnchor,
  DiffCommentSide,
  DiffHunkLine,
  DiffView,
  FileDiff,
  FileDiffStatus,
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

function viewStorageKey(sessionId: SessionId | undefined): string | null {
  return sessionId ? `${STORAGE_PREFIXES.diffView}${sessionId}` : null;
}

function readPersistedView(sessionId: SessionId | undefined): DiffView | null {
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
}

function writePersistedView(sessionId: SessionId | undefined, view: DiffView): void {
  const key = viewStorageKey(sessionId);
  if (!key || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(view));
  } catch {
    // ignore
  }
}

function loadDiffForView(worktreePath: string, view: DiffView): Promise<string> {
  if (view.kind === 'working') {
    return worktreeDiffWorking(worktreePath, view.scope);
  }
  if (view.kind === 'commit') {
    return worktreeDiffCommit(worktreePath, view.sha);
  }
  return worktreeDiff(worktreePath);
}

function emptyStateLabel(view: DiffView, isGitAware: boolean): string {
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
}

function emptyStateBlurb(view: DiffView, isGitAware: boolean): string | null {
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
}

const LINE_PREFIX: Record<DiffHunkLine['kind'], string> = {
  add: '+',
  del: '-',
  context: ' ',
};

const STATUS_GLYPH: Record<FileDiffStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

const STATUS_COLOR: Record<FileDiffStatus, string> = {
  added: 'text-success',
  modified: 'text-info',
  deleted: 'text-danger',
  renamed: 'text-warning',
};

const SIDEBAR_PREF_KEY = STORAGE_KEYS.diffSidebarCollapsed;

const INITIAL_VISIBLE_LINES = 1000;
const VISIBLE_LINES_STEP = 2000;

const TOOLBAR_ICON_BTN =
  'rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground' as const;

type TreeNode =
  | {
      kind: 'dir';
      name: string;
      children: TreeNode[];
      additions: number;
      deletions: number;
    }
  | { kind: 'file'; name: string; file: FileDiff; index: number };

function buildTree(files: ReadonlyArray<FileDiff>): TreeNode {
  const root: TreeNode = { kind: 'dir', name: '', children: [], additions: 0, deletions: 0 };
  files.forEach((f, idx) => {
    const parts = f.path.split('/');
    const fileName = parts.pop() ?? f.path;
    let cur = root as Extract<TreeNode, { kind: 'dir' }>;
    for (const part of parts) {
      let next = cur.children.find(
        (c): c is Extract<TreeNode, { kind: 'dir' }> => c.kind === 'dir' && c.name === part,
      );
      if (!next) {
        next = { kind: 'dir', name: part, children: [], additions: 0, deletions: 0 };
        cur.children.push(next);
      }
      cur = next;
    }
    cur.children.push({ kind: 'file', name: fileName, file: f, index: idx });
  });

  const collapse = (node: TreeNode) => {
    if (node.kind !== 'dir') {
      return;
    }
    while (node.children.length === 1) {
      const only = node.children[0];
      if (!only || only.kind !== 'dir') {
        break;
      }
      node.name = node.name ? `${node.name}/${only.name}` : only.name;
      node.children = only.children;
    }
    for (const c of node.children) collapse(c);
  };
  for (const c of root.children) collapse(c);

  const aggregate = (node: TreeNode): { a: number; d: number } => {
    if (node.kind === 'file') {
      return { a: node.file.additions, d: node.file.deletions };
    }
    let a = 0;
    let d = 0;
    for (const c of node.children) {
      const r = aggregate(c);
      a += r.a;
      d += r.d;
    }
    node.additions = a;
    node.deletions = d;
    return { a, d };
  };
  aggregate(root);

  const sort = (node: TreeNode) => {
    if (node.kind !== 'dir') {
      return;
    }
    node.children.sort((x, y) => {
      if (x.kind !== y.kind) {
        return x.kind === 'dir' ? -1 : 1;
      }
      return x.name.localeCompare(y.name);
    });
    for (const c of node.children) sort(c);
  };
  sort(root);

  return root;
}

function buildNotesPrompt(notes: ReadonlyArray<DiffComment>): string {
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
}

function readSidebarPref(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.localStorage.getItem(SIDEBAR_PREF_KEY) !== '0';
}

function writeSidebarPref(collapsed: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? '1' : '0');
}

type ReviewState = 'none' | 'reviewed' | 'stale';
type ReviewedMap = Record<string, string>;

function viewKeyOf(view: DiffView): string {
  if (view.kind === 'commit') {
    return `commit:${view.sha}`;
  }
  if (view.kind === 'working') {
    return `working:${view.scope}`;
  }
  return 'branch';
}

function fileSignature(f: FileDiff): string {
  return `${f.status}:${f.additions}:${f.deletions}:${f.hunks.length}:${f.hunks
    .map((h) => h.header)
    .join('§')}`;
}

function reviewedStorageKey(sessionId: SessionId | undefined, view: DiffView): string | null {
  return sessionId ? `${STORAGE_PREFIXES.diffReviewed}${sessionId}:${viewKeyOf(view)}` : null;
}

function readReviewedMap(sessionId: SessionId | undefined, view: DiffView): ReviewedMap {
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
}

function writeReviewedMap(
  sessionId: SessionId | undefined,
  view: DiffView,
  map: ReviewedMap,
): void {
  const key = reviewedStorageKey(sessionId, view);
  if (!key || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore
  }
}

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
      { root: scrollRef.current, rootMargin: '0px 0px -70% 0px', threshold: 0 },
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

  return (
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- container handles keyboard nav */
    <div className="flex h-full min-h-0 w-full flex-col" onKeyDown={handleKeyDown}>
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            loading diff…
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center text-xs text-danger">{error}</div>
        ) : files.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-muted/50"
            >
              <CheckCircle2 size={22} className="text-success" />
            </span>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-sm font-medium text-foreground">
                {emptyStateLabel(view, isGitAware)}
              </span>
              {emptyStateBlurb(view, isGitAware) ? (
                <span className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  {emptyStateBlurb(view, isGitAware)}
                </span>
              ) : null}
              {isGitAware ? (
                <span className="mt-1.5 text-[11px] text-muted-foreground/60">
                  Pick another view from the selector above.
                </span>
              ) : null}
            </div>
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
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              {files.map((file) => (
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
                  onAddFileLevelComment={(body) => void handleAddFileLevelComment(file.path, body)}
                  onResolve={(id) => sessionId && void resolveDiffComment(sessionId, id)}
                  onReopen={(id) => sessionId && void reopenDiffComment(sessionId, id)}
                  onDelete={(id) => sessionId && void deleteDiffComment(sessionId, id)}
                  onViewAgent={(id) => void handleViewAgent(id)}
                  getAgentName={(id) => agentNameById.get(id)}
                />
              ))}
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
    title="Files touched"
    workspaceName={workspaceName}
    closeLabel="close files touched"
    onClose={onClose}
    variant="slot"
  >
    {(requestClose) => (
      <DiffViewerContent {...rest} onClose={requestClose} showToolbarClose={false} />
    )}
  </StudioShell>
);

type DiffToolbarProps = {
  title?: string;
  prNumber?: number;
  openCommentsCount: number;
  reviewedCount: number | null;
  filesCount: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  status: WorktreeStatus | null;
  onRefresh?: () => void;
  refreshing: boolean;
  showClose: boolean;
  onClose: () => void;
  viewSelector?: React.ReactNode;
};

function DiffToolbar({
  title,
  prNumber,
  openCommentsCount,
  reviewedCount,
  filesCount,
  sidebarCollapsed,
  onToggleSidebar,
  status,
  onRefresh,
  refreshing,
  showClose,
  onClose,
  viewSelector,
}: DiffToolbarProps) {
  const titleText = title ?? (prNumber !== undefined ? `pr #${prNumber} diff` : 'diff');
  const aheadBehind =
    status?.hasUpstream && (status.ahead > 0 || status.behind > 0)
      ? `↑${status.ahead} ↓${status.behind}`
      : null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border-soft px-2.5 py-1.5">
      <button
        type="button"
        onClick={onToggleSidebar}
        className={TOOLBAR_ICON_BTN}
        title={sidebarCollapsed ? 'show file list' : 'hide file list'}
        aria-label={sidebarCollapsed ? 'show file list' : 'hide file list'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {viewSelector ?? (
          <span className="shrink-0 text-xs font-semibold tracking-tight text-foreground">
            {titleText}
          </span>
        )}
        {openCommentsCount > 0 ? (
          <span
            className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning"
            title={`${openCommentsCount} open ${openCommentsCount === 1 ? 'note' : 'notes'}`}
          >
            {openCommentsCount} {openCommentsCount === 1 ? 'note' : 'notes'}
          </span>
        ) : null}
        {reviewedCount !== null && filesCount > 0 ? (
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              reviewedCount === filesCount
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground',
            )}
            title={`${reviewedCount} of ${filesCount} files reviewed`}
          >
            <Check size={9} aria-hidden />
            {reviewedCount}/{filesCount} reviewed
          </span>
        ) : null}
      </div>

      {status?.branch ? (
        <span className="hidden min-w-0 shrink items-center gap-1.5 text-2xs text-muted-foreground md:flex">
          <GitBranch size={11} aria-hidden className="shrink-0 text-muted-foreground/70" />
          <span className="truncate font-mono">{status.branch}</span>
          {aheadBehind ? <span className="shrink-0 tabular-nums">{aheadBehind}</span> : null}
        </span>
      ) : null}

      <div className="flex shrink-0 items-center gap-0.5">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="refresh git state"
            aria-label="refresh git state"
            className={cn(TOOLBAR_ICON_BTN, 'disabled:opacity-50')}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} aria-hidden />
          </button>
        ) : null}
        {showClose ? (
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
    </div>
  );
}

type NotesFooterProps = {
  openCount: number;
  spawning: boolean;
  onPropose: () => void;
};

function NotesFooter({ openCount, spawning, onPropose }: NotesFooterProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border-soft bg-muted/20 px-4 py-2.5">
      <span className="text-xs text-muted-foreground">
        {openCount} open {openCount === 1 ? 'note' : 'notes'} · spawn a reviewer to propose fixes
      </span>
      <button
        type="button"
        onClick={onPropose}
        disabled={spawning}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        title="spawn a reviewer agent that proposes fixes without touching code"
      >
        {spawning ? (
          <Loader2 size={11} className="animate-spin" aria-hidden />
        ) : (
          <Sparkles size={11} aria-hidden />
        )}
        Propose fixes
      </button>
    </div>
  );
}

function FileRail({
  files,
  activePath,
  onSelect,
  reviewStateByPath,
  commentCounts,
}: {
  files: ReadonlyArray<FileDiff>;
  activePath: string | null;
  onSelect: (path: string) => void;
  reviewStateByPath: Map<string, ReviewState>;
  commentCounts: Map<string, number>;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const tree = useMemo(() => buildTree(files), [files]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activePath]);

  return (
    <ScrollArea className="w-[26%] shrink-0 overflow-y-auto border-r border-border-soft bg-muted/10">
      <div className="py-1">
        {tree.kind === 'dir' &&
          tree.children.map((child, i) => (
            <TreeNodeView
              key={`${child.kind}-${child.name}-${i}`}
              node={child}
              depth={0}
              activePath={activePath}
              onSelect={onSelect}
              selectedRef={selectedRef}
              reviewStateByPath={reviewStateByPath}
              commentCounts={commentCounts}
            />
          ))}
      </div>
    </ScrollArea>
  );
}

function TreeNodeView({
  node,
  depth,
  activePath,
  onSelect,
  selectedRef,
  reviewStateByPath,
  commentCounts,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  onSelect: (path: string) => void;
  selectedRef: React.RefObject<HTMLButtonElement | null>;
  reviewStateByPath: Map<string, ReviewState>;
  commentCounts: Map<string, number>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pathCopied, setPathCopied] = useState(false);
  const { showToast } = useToast();
  const indent = depth * 10;

  const copyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path).then(
      () => {
        setPathCopied(true);
        showToast('success', 'path copied');
        window.setTimeout(() => setPathCopied(false), 1500);
      },
      () => {
        showToast('error', 'failed to copy path');
      },
    );
  };

  if (node.kind === 'file') {
    const { file } = node;
    const isSelected = file.path === activePath;
    const noteCount = commentCounts.get(file.path) ?? 0;
    const reviewState = reviewStateByPath.get(file.path) ?? 'none';
    return (
      <div
        className={cn(
          'group relative flex w-full items-center gap-2 py-1 pr-1 font-mono text-xs transition-colors',
          isSelected
            ? 'border-l-2 border-primary bg-muted/60 text-foreground'
            : 'border-l-2 border-transparent text-muted-foreground/80 hover:bg-muted/30 hover:text-foreground',
          reviewState === 'reviewed' && !isSelected && 'opacity-50',
        )}
        style={{ paddingLeft: 10 + indent }}
      >
        <button
          ref={isSelected ? selectedRef : null}
          type="button"
          onClick={() => onSelect(file.path)}
          title={file.path}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {reviewState === 'reviewed' ? (
            <Check size={11} aria-hidden className="w-3 shrink-0 text-success" />
          ) : (
            <span
              className={cn(
                'w-3 shrink-0 text-center text-[10px] font-bold',
                STATUS_COLOR[file.status],
              )}
            >
              {STATUS_GLYPH[file.status]}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {reviewState === 'stale' ? (
            <span
              className="shrink-0 rounded-full bg-muted px-1 text-[9px] font-medium text-muted-foreground"
              title="previously reviewed, changed since"
            >
              ↻
            </span>
          ) : null}
          {noteCount > 0 && (
            <span className="shrink-0 rounded-full bg-warning/15 px-1 text-[9px] font-medium text-warning">
              {noteCount}
            </span>
          )}
          <span className="shrink-0 text-[10px] tabular-nums">
            {file.additions > 0 && <span className="text-success">+{file.additions}</span>}
            {file.additions > 0 && file.deletions > 0 && <span className="opacity-40"> </span>}
            {file.deletions > 0 && <span className="text-danger">−{file.deletions}</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => copyPath(file.path, e)}
          title="copy path"
          aria-label="copy file path"
          className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          {pathCopied ? <Check size={10} aria-hidden /> : <Copy size={10} aria-hidden />}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1 py-1 pr-2.5 text-left text-xs text-muted-foreground/60 hover:text-foreground"
        style={{ paddingLeft: 6 + indent }}
        title={node.name}
      >
        <ChevronRight
          size={10}
          aria-hidden
          className={cn('shrink-0 transition-transform duration-150', expanded && 'rotate-90')}
        />
        <span className="min-w-0 flex-1 truncate font-mono">{node.name}</span>
        {!expanded && (node.additions > 0 || node.deletions > 0) ? (
          <span className="shrink-0 text-[10px] tabular-nums">
            {node.additions > 0 && <span className="text-success/70">+{node.additions}</span>}
            {node.additions > 0 && node.deletions > 0 && <span className="opacity-40"> </span>}
            {node.deletions > 0 && <span className="text-danger/70">−{node.deletions}</span>}
          </span>
        ) : null}
      </button>
      {expanded
        ? node.children.map((child, i) => (
            <TreeNodeView
              key={`${child.kind}-${child.name}-${i}`}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onSelect={onSelect}
              selectedRef={selectedRef}
              reviewStateByPath={reviewStateByPath}
              commentCounts={commentCounts}
            />
          ))
        : null}
    </>
  );
}

function CommentItem({
  comment,
  onResolve,
  onReopen,
  onDelete,
  onViewAgent,
  getAgentName,
}: {
  comment: DiffComment;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onViewAgent: (agentId: AgentId) => void;
  getAgentName: (agentId: AgentId) => string | undefined;
}) {
  const agentName = comment.consumedByAgentId ? getAgentName(comment.consumedByAgentId) : undefined;
  const containerClass =
    comment.status === 'resolved'
      ? 'border-success/40 bg-success/5 opacity-60'
      : comment.status === 'consumed'
        ? 'border-info/40 bg-info/5'
        : 'border-warning bg-warning/5';
  const statusPill =
    comment.status === 'resolved'
      ? { label: 'resolved', cls: 'bg-success/15 text-success' }
      : comment.status === 'consumed'
        ? { label: 'in progress', cls: 'bg-info/15 text-info' }
        : null;
  return (
    <div
      className={cn('group flex flex-col gap-1.5 rounded-md border-l-2 px-3 py-2', containerClass)}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-semibold uppercase text-muted-foreground"
        >
          ME
        </span>
        <span className="text-[11px] font-medium text-foreground">you</span>
        <span className="text-[10px] text-muted-foreground/70">
          {relativeTime(comment.createdAt)}
        </span>
        {statusPill ? (
          <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-medium', statusPill.cls)}>
            {statusPill.label}
          </span>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {comment.status === 'open' && (
            <button
              type="button"
              onClick={() => onResolve(comment.id)}
              title="mark resolved"
              aria-label="resolve"
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-success"
            >
              <Check size={11} />
            </button>
          )}
          {comment.status === 'consumed' && (
            <button
              type="button"
              onClick={() => onReopen(comment.id)}
              title="reopen note"
              aria-label="reopen"
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-warning"
            >
              <RotateCcw size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            title="delete"
            aria-label="delete"
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-danger"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
        {comment.status === 'resolved' ? (
          <span className="line-through">{comment.body}</span>
        ) : (
          comment.body
        )}
      </p>
      {comment.status === 'consumed' && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {agentName && comment.consumedByAgentId ? (
            <>
              <span>consumed by</span>
              <button
                type="button"
                onClick={() => onViewAgent(comment.consumedByAgentId as AgentId)}
                className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-info hover:bg-info/10 hover:text-info"
              >
                <span className="font-medium">{agentName}</span>
                <ArrowUpRight size={9} aria-hidden />
              </button>
            </>
          ) : (
            <span className="italic">consumed by removed agent</span>
          )}
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) {
    return 'just now';
  }
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.round(min / 60);
  if (hr < 24) {
    return `${hr}h ago`;
  }
  return `${Math.round(hr / 24)}d ago`;
}

function lineAnchor(line: DiffHunkLine): DiffCommentAnchor | null {
  if (line.kind === 'del') {
    return line.oldLine !== null ? { side: 'old', lineNumber: line.oldLine } : null;
  }
  return line.newLine !== null ? { side: 'new', lineNumber: line.newLine } : null;
}

function anchorKey(a: DiffCommentAnchor): string {
  return `${a.side}:${a.lineNumber}`;
}

type FileDiffCardProps = {
  file: FileDiff;
  registerRef: (el: HTMLElement | null) => void;
  reviewState: ReviewState;
  onToggleReviewed: (next: boolean) => void;
  canOpenEditor: boolean;
  onOpenInEditor: () => void;
  comments: ReadonlyArray<DiffComment>;
  canComment: boolean;
  onAddComment: (anchor: DiffCommentAnchor, body: string) => void;
  onAddFileLevelComment: (body: string) => void;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onViewAgent: (agentId: AgentId) => void;
  getAgentName: (agentId: AgentId) => string | undefined;
};

function FileDiffCard({
  file,
  registerRef,
  reviewState,
  onToggleReviewed,
  canOpenEditor,
  onOpenInEditor,
  comments,
  canComment,
  onAddComment,
  onAddFileLevelComment,
  onResolve,
  onReopen,
  onDelete,
  onViewAgent,
  getAgentName,
}: FileDiffCardProps) {
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState(reviewState === 'reviewed');
  const [activeAnchor, setActiveAnchor] = useState<DiffCommentAnchor | null>(null);
  const [fileLevelComposerOpen, setFileLevelComposerOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);

  const isReviewed = reviewState === 'reviewed';
  const handleToggleReviewed = () => {
    const next = !isReviewed;
    onToggleReviewed(next);
    setCollapsed(next);
  };

  const copyPath = () => {
    navigator.clipboard.writeText(file.path).then(
      () => {
        setPathCopied(true);
        showToast('success', 'path copied');
        window.setTimeout(() => setPathCopied(false), 1500);
      },
      () => showToast('error', 'failed to copy path'),
    );
  };

  const resolvedCount = useMemo(
    () => comments.filter((c) => c.status === 'resolved').length,
    [comments],
  );
  const visibleComments = useMemo(
    () => (showResolved ? comments : comments.filter((c) => c.status !== 'resolved')),
    [comments, showResolved],
  );
  const fileLevelComments = useMemo(
    () => visibleComments.filter((c) => !c.anchor),
    [visibleComments],
  );

  const commentsByAnchor = useMemo(() => {
    const m = new Map<string, DiffComment[]>();
    for (const c of visibleComments) {
      if (!c.anchor) {
        continue;
      }
      const k = anchorKey(c.anchor);
      const arr = m.get(k);
      if (arr) {
        arr.push(c);
      } else {
        m.set(k, [c]);
      }
    }
    return m;
  }, [visibleComments]);

  const commentedRange = useMemo(() => {
    const set = new Set<string>();
    for (const c of comments) {
      if (!c.anchor?.endLineNumber || c.status === 'resolved') {
        continue;
      }
      for (let n = c.anchor.lineNumber; n <= c.anchor.endLineNumber; n++) {
        set.add(`${c.anchor.side}:${n}`);
      }
    }
    return set;
  }, [comments]);

  const [drag, setDrag] = useState<{ side: DiffCommentSide; start: number; end: number } | null>(
    null,
  );
  const dragLo = drag ? Math.min(drag.start, drag.end) : 0;
  const dragHi = drag ? Math.max(drag.start, drag.end) : 0;
  const inDrag = (a: DiffCommentAnchor | null): boolean =>
    drag !== null &&
    a !== null &&
    a.side === drag.side &&
    a.lineNumber >= dragLo &&
    a.lineNumber <= dragHi;

  useEffect(() => {
    if (!drag) {
      return;
    }
    const onUp = () => {
      const lo = Math.min(drag.start, drag.end);
      const hi = Math.max(drag.start, drag.end);
      setActiveAnchor({
        side: drag.side,
        lineNumber: lo,
        ...(hi > lo ? { endLineNumber: hi } : {}),
      });
      setDrag(null);
    };
    window.addEventListener('pointerup', onUp);
    return () => window.removeEventListener('pointerup', onUp);
  }, [drag]);

  const handleSubmitComment = (anchor: DiffCommentAnchor, body: string) => {
    onAddComment(anchor, body);
    setActiveAnchor(null);
  };
  const handleSubmitFileLevel = (body: string) => {
    onAddFileLevelComment(body);
    setFileLevelComposerOpen(false);
  };

  const rows = useMemo(() => {
    const out: Array<
      | { type: 'header'; hi: number; header: string }
      | { type: 'line'; hi: number; li: number; line: DiffHunkLine }
    > = [];
    file.hunks.forEach((hunk, hi) => {
      out.push({ type: 'header', hi, header: hunk.header });
      hunk.lines.forEach((line, li) => out.push({ type: 'line', hi, li, line }));
    });
    return out;
  }, [file]);

  const totalLines = useMemo(() => file.hunks.reduce((n, h) => n + h.lines.length, 0), [file]);

  const [visibleLines, setVisibleLines] = useState(INITIAL_VISIBLE_LINES);

  const visibleRows = useMemo(() => {
    if (visibleLines >= totalLines) {
      return rows;
    }
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.type === 'line') {
        count += 1;
        if (count >= visibleLines) {
          return rows.slice(0, i + 1);
        }
      }
    }
    return rows;
  }, [rows, visibleLines, totalLines]);

  const remaining = Math.max(0, totalLines - visibleLines);
  const noteCount = comments.filter((c) => c.status === 'open').length;

  return (
    <section ref={registerRef} data-file-path={file.path} className="border-b border-border-soft">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border-soft bg-background px-3 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'expand file' : 'collapse file'}
          aria-label={collapsed ? 'expand file' : 'collapse file'}
          className={TOOLBAR_ICON_BTN}
        >
          <ChevronRight
            size={13}
            aria-hidden
            className={cn('transition-transform duration-150', !collapsed && 'rotate-90')}
          />
        </button>
        <span
          className={cn(
            'w-3 shrink-0 text-center font-mono text-[11px] font-bold',
            STATUS_COLOR[file.status],
          )}
          title={file.status}
        >
          {STATUS_GLYPH[file.status]}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="min-w-0 flex-1 truncate text-left font-mono text-xs text-foreground"
          title={file.path}
        >
          {file.path}
        </button>
        {reviewState === 'stale' ? (
          <span
            className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            title="this file changed since you last reviewed it"
          >
            previously reviewed
          </span>
        ) : null}
        {noteCount > 0 ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
            {noteCount} {noteCount === 1 ? 'note' : 'notes'}
          </span>
        ) : null}
        <span className="shrink-0 text-[10px] tabular-nums">
          {file.additions > 0 && <span className="text-success">+{file.additions}</span>}
          {file.additions > 0 && file.deletions > 0 && <span className="opacity-40"> </span>}
          {file.deletions > 0 && <span className="text-danger">−{file.deletions}</span>}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={copyPath}
            title="copy path"
            aria-label="copy file path"
            className={TOOLBAR_ICON_BTN}
          >
            {pathCopied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          </button>
          {canOpenEditor ? (
            <button
              type="button"
              onClick={onOpenInEditor}
              title="open file in editor"
              aria-label="open file in editor"
              className={TOOLBAR_ICON_BTN}
            >
              <ExternalLink size={12} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleToggleReviewed}
            title={isReviewed ? 'mark as not reviewed' : 'mark as reviewed'}
            className={cn(
              'ml-1 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              isReviewed
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-3 items-center justify-center rounded-[3px] border',
                isReviewed
                  ? 'border-success bg-success text-background'
                  : 'border-muted-foreground/50',
              )}
            >
              {isReviewed ? <Check size={8} aria-hidden /> : null}
            </span>
            Viewed
          </button>
        </div>
      </div>
      {collapsed ? null : (
        <div className="p-3">
          {resolvedCount > 0 ? (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight
                  size={10}
                  aria-hidden
                  className={cn('transition-transform duration-150', showResolved && 'rotate-90')}
                />
                {showResolved ? 'hide' : 'show'} {resolvedCount} resolved{' '}
                {resolvedCount === 1 ? 'comment' : 'comments'}
              </button>
            </div>
          ) : null}
          {fileLevelComments.length > 0 || fileLevelComposerOpen ? (
            <div className="mb-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  file notes
                </span>
                {canComment && !fileLevelComposerOpen ? (
                  <button
                    type="button"
                    onClick={() => setFileLevelComposerOpen(true)}
                    title="add file-level note"
                    aria-label="add file-level note"
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <MessageSquarePlus size={11} aria-hidden />
                  </button>
                ) : null}
              </div>
              {fileLevelComments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onResolve={onResolve}
                  onReopen={onReopen}
                  onDelete={onDelete}
                  onViewAgent={onViewAgent}
                  getAgentName={getAgentName}
                />
              ))}
              {fileLevelComposerOpen ? (
                <InlineComposer
                  onSubmit={handleSubmitFileLevel}
                  onCancel={() => setFileLevelComposerOpen(false)}
                />
              ) : null}
            </div>
          ) : canComment ? (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setFileLevelComposerOpen(true)}
                title="add file-level note"
                className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MessageSquarePlus size={10} aria-hidden />
                Add file note
              </button>
            </div>
          ) : null}
          {file.binary ? (
            <p className="py-4 text-center text-xs text-muted-foreground">binary file, no diff</p>
          ) : file.hunks.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">no changes</p>
          ) : (
            <>
              <table
                className={cn(
                  'w-full border-collapse font-mono text-xs leading-5',
                  drag && 'select-none',
                )}
              >
                <tbody>
                  {visibleRows.map((row) => {
                    if (row.type === 'header') {
                      return (
                        <tr key={`hunk-${row.hi}`}>
                          <td
                            colSpan={4}
                            className="bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {row.header}
                          </td>
                        </tr>
                      );
                    }
                    const { line, hi, li } = row;
                    const anchor = lineAnchor(line);
                    const lineComments = anchor
                      ? (commentsByAnchor.get(anchorKey(anchor)) ?? [])
                      : [];
                    const isActive =
                      anchor !== null &&
                      activeAnchor !== null &&
                      activeAnchor.side === anchor.side &&
                      activeAnchor.lineNumber === anchor.lineNumber;
                    const linePrefix = LINE_PREFIX[line.kind];
                    const rangeCommented = anchor !== null && commentedRange.has(anchorKey(anchor));
                    const selecting = inDrag(anchor);
                    return (
                      <Fragment key={`hunk-${hi}-line-${li}`}>
                        <tr
                          onMouseEnter={() => {
                            if (drag && anchor && anchor.side === drag.side) {
                              setDrag((d) => (d ? { ...d, end: anchor.lineNumber } : d));
                            }
                          }}
                          className={cn(
                            'group',
                            line.kind === 'add' && 'bg-success/10',
                            line.kind === 'del' && 'bg-danger/10',
                            selecting && 'bg-primary/15',
                          )}
                        >
                          <td
                            className={cn(
                              'w-6 select-none px-0.5 align-top',
                              rangeCommented && 'border-l-2 border-warning/60',
                            )}
                          >
                            {canComment && anchor ? (
                              <button
                                type="button"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  setDrag({
                                    side: anchor.side,
                                    start: anchor.lineNumber,
                                    end: anchor.lineNumber,
                                  });
                                }}
                                title="comment on this line (drag to select a range)"
                                aria-label="comment on this line"
                                className={cn(
                                  'flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
                                  isActive || selecting
                                    ? 'opacity-100'
                                    : 'opacity-0 group-hover:opacity-100',
                                )}
                              >
                                <MessageSquarePlus size={9} aria-hidden />
                              </button>
                            ) : null}
                          </td>
                          <td className="w-8 select-none px-1.5 text-right text-[10px] text-muted-foreground/60">
                            {line.oldLine ?? ''}
                          </td>
                          <td className="w-8 select-none px-1.5 text-right text-[10px] text-muted-foreground/60">
                            {line.newLine ?? ''}
                          </td>
                          <td
                            className={cn(
                              'whitespace-pre px-2',
                              line.kind === 'add' && 'text-success',
                              line.kind === 'del' && 'text-danger',
                            )}
                          >
                            {linePrefix}
                            {line.text}
                          </td>
                        </tr>
                        {lineComments.length > 0 && (
                          <tr>
                            <td colSpan={4} className="bg-background px-3 py-2">
                              <div className="flex flex-col gap-1.5">
                                {lineComments.map((c) => (
                                  <div key={c.id} className="flex flex-col gap-0.5">
                                    {c.anchor?.endLineNumber ? (
                                      <span className="text-[10px] font-medium text-muted-foreground">
                                        lines {c.anchor.lineNumber}–{c.anchor.endLineNumber}
                                      </span>
                                    ) : null}
                                    <CommentItem
                                      comment={c}
                                      onResolve={onResolve}
                                      onReopen={onReopen}
                                      onDelete={onDelete}
                                      onViewAgent={onViewAgent}
                                      getAgentName={getAgentName}
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        {isActive && anchor ? (
                          <tr>
                            <td colSpan={4} className="bg-background px-3 py-2">
                              <InlineComposer
                                label={
                                  activeAnchor?.endLineNumber
                                    ? `commenting on lines ${activeAnchor.lineNumber}–${activeAnchor.endLineNumber}`
                                    : `commenting on line ${anchor.lineNumber}`
                                }
                                onSubmit={(body) =>
                                  handleSubmitComment(activeAnchor ?? anchor, body)
                                }
                                onCancel={() => setActiveAnchor(null)}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {remaining > 0 && (
                <ShowMoreBar
                  step={Math.min(VISIBLE_LINES_STEP, remaining)}
                  rendered={Math.min(visibleLines, totalLines)}
                  total={totalLines}
                  onShowMore={() => setVisibleLines((n) => n + VISIBLE_LINES_STEP)}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ShowMoreBar({
  step,
  rendered,
  total,
  onShowMore,
}: {
  step: number;
  rendered: number;
  total: number;
  onShowMore: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 border-t border-border-soft bg-muted/20 py-3">
      <button
        type="button"
        onClick={onShowMore}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
      >
        <ChevronsDown size={12} aria-hidden />
        Show {step.toLocaleString()} more lines
      </button>
      <span className="text-[10px] text-muted-foreground/60">
        showing {rendered.toLocaleString()} of {total.toLocaleString()} lines
      </span>
    </div>
  );
}

function InlineComposer({
  onSubmit,
  onCancel,
  label,
}: {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  label?: string;
}) {
  const [body, setBody] = useState('');
  const trimmed = body.trim();
  return (
    <div className="flex gap-2 rounded-md border border-border-soft bg-background px-2 py-1.5">
      <MessageSquarePlus size={13} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {label ? (
          <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        ) : null}
        <Textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="note for the agent… (⌘↵ to save)"
          className="text-xs"
          autoGrow
          maxRows={6}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (trimmed.length > 0) {
                onSubmit(trimmed);
              }
            }
          }}
        />
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => trimmed.length > 0 && onSubmit(trimmed)}
            disabled={trimmed.length === 0}
            className="inline-flex items-center gap-1 rounded-sm bg-foreground px-2 py-0.5 text-[10px] font-medium text-background hover:opacity-80 disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
