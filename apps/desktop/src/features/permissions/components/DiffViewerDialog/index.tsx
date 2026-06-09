import { Fragment, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronsRight,
  Copy,
  ExternalLink,
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

type DiffViewerDialogProps = {
  open: boolean;
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
};

// Default to the same scope the sidebar files-touched counter uses
// (branch vs main) so opening the dialog matches what the count promises.
const DEFAULT_VIEW: DiffView = { kind: 'branch' };

function viewStorageKey(sessionId: SessionId | undefined): string | null {
  return sessionId ? `${STORAGE_PREFIXES.diffView}${sessionId}` : null;
}

function readPersistedView(sessionId: SessionId | undefined): DiffView | null {
  const key = viewStorageKey(sessionId);
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiffView;
    if (parsed && typeof parsed === 'object' && 'kind' in parsed) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function writePersistedView(sessionId: SessionId | undefined, view: DiffView): void {
  const key = viewStorageKey(sessionId);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(view));
  } catch {
    // ignore
  }
}

function loadDiffForView(worktreePath: string, view: DiffView): Promise<string> {
  if (view.kind === 'working') return worktreeDiffWorking(worktreePath, view.scope);
  if (view.kind === 'commit') return worktreeDiffCommit(worktreePath, view.sha);
  return worktreeDiff(worktreePath);
}

function emptyStateLabel(view: DiffView, isGitAware: boolean): string {
  if (!isGitAware) return 'No diff available';
  if (view.kind === 'working') {
    if (view.scope === 'staged') return 'No staged changes';
    if (view.scope === 'unstaged') return 'No unstaged changes';
    return 'Working tree clean';
  }
  if (view.kind === 'commit') return 'This commit is empty';
  return 'Branch matches main';
}

function emptyStateBlurb(view: DiffView, isGitAware: boolean): string | null {
  if (!isGitAware) return null;
  if (view.kind === 'working') {
    if (view.scope === 'staged') return 'Nothing has been staged for the next commit yet.';
    if (view.scope === 'unstaged') return 'No uncommitted edits in the working tree.';
    return 'No uncommitted edits and nothing staged.';
  }
  if (view.kind === 'commit') return 'No file changes were recorded for this commit.';
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
    if (node.kind !== 'dir') return;
    while (node.children.length === 1) {
      const only = node.children[0];
      if (!only || only.kind !== 'dir') break;
      node.name = node.name ? `${node.name}/${only.name}` : only.name;
      node.children = only.children;
    }
    for (const c of node.children) collapse(c);
  };
  for (const c of root.children) collapse(c);

  const aggregate = (node: TreeNode): { a: number; d: number } => {
    if (node.kind === 'file') return { a: node.file.additions, d: node.file.deletions };
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
    if (node.kind !== 'dir') return;
    node.children.sort((x, y) => {
      if (x.kind !== y.kind) return x.kind === 'dir' ? -1 : 1;
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
      const anchor = n.anchor ? `[${n.anchor.side}:${n.anchor.lineNumber}]` : '[file-level]';
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
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_PREF_KEY) === '1';
}

function writeSidebarPref(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? '1' : '0');
}

export const DiffViewerDialog = ({
  open,
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
}: DiffViewerDialogProps) => {
  const [files, setFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPref);
  const [activeAnchor, setActiveAnchor] = useState<DiffCommentAnchor | null>(null);
  const [fileLevelComposerOpen, setFileLevelComposerOpen] = useState(false);

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

  useEffect(() => {
    if (
      open &&
      isGitAware &&
      prevSummarizerStatus.current === 'running' &&
      summarizer.status !== 'running'
    ) {
      setRefreshTick((t) => t + 1);
    }
    prevSummarizerStatus.current = summarizer.status;
  }, [summarizer.status, open, isGitAware]);

  const selectAgent = useAppStore((s) => s.selectAgent);
  const phaseRuns = useAppStore((s) =>
    sessionId ? (s.sessionPhaseRuns[sessionId] ?? null) : null,
  );
  const agentNameById = useMemo(() => {
    const m = new Map<AgentId, string>();
    if (phaseRuns) for (const r of phaseRuns) m.set(r.id, r.name);
    return m;
  }, [phaseRuns]);

  const openCommentsByFile = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) {
      if (c.status !== 'open') continue;
      m.set(c.filePath, (m.get(c.filePath) ?? 0) + 1);
    }
    return m;
  }, [comments]);

  useEffect(() => {
    if (open) setViewState(DEFAULT_VIEW);
  }, [open]);

  useEffect(() => {
    if (!open || !worktreePath) return;
    let cancelled = false;
    Promise.all([listBranchCommits(worktreePath), worktreeStatus(worktreePath)])
      .then(([c, s]) => {
        if (cancelled) return;
        setCommits(c);
        setStatus(s);
      })
      .catch(() => {
        // best-effort; the diff effect surfaces hard errors
      });
    return () => {
      cancelled = true;
    };
  }, [open, worktreePath, refreshTick]);

  useEffect(() => {
    if (!open) return;
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
    setActiveAnchor(null);
    fetcher()
      .then((raw) => {
        if (cancelled) return;
        const parsed = parseUnifiedDiff(raw);
        setFiles(parsed);
        setLoading(false);
        if (jumpToFile) {
          const idx = parsed.findIndex((f) => f.path === jumpToFile || jumpToFile.endsWith(f.path));
          setSelectedIdx(idx >= 0 ? idx : 0);
        } else if (jumpToFirstCommented && openCommentsByFile.size > 0) {
          const idx = parsed.findIndex((f) => openCommentsByFile.has(f.path));
          setSelectedIdx(idx >= 0 ? idx : 0);
        } else {
          setSelectedIdx(0);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(formatError(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    isGitAware,
    worktreePath,
    view,
    refreshTick,
    loader,
    repoSlug,
    prNumber,
    cwd,
    jumpToFirstCommented,
    jumpToFile,
    openCommentsByFile,
  ]);

  useEffect(() => {
    if (open && sessionId) void loadDiffComments(sessionId);
  }, [open, sessionId, loadDiffComments]);

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
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'j') {
        setSelectedIdx((i) => Math.min(i + 1, files.length - 1));
      } else if (e.key === 'k') {
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
    },
    [files.length, onClose],
  );

  const selected = files[selectedIdx];
  const selectedComments = useMemo(
    () => (selected ? comments.filter((c) => c.filePath === selected.path) : []),
    [comments, selected],
  );
  const fileLevelComments = useMemo(
    () => selectedComments.filter((c) => !c.anchor),
    [selectedComments],
  );

  useEffect(() => {
    setActiveAnchor(null);
    setFileLevelComposerOpen(false);
  }, [selectedIdx]);

  const editorBinary = useAppStore(
    (s) =>
      s.settings[SETTING_DEFAULT_EDITOR] ??
      s.settings[SETTING_EDITOR_BINARY] ??
      DEFAULT_EDITOR_BINARY,
  );

  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const sendTurn = useAppStore((s) => s.sendTurn);
  const [spawning, setSpawning] = useState(false);

  const openComments = useMemo(() => comments.filter((c) => c.status === 'open'), [comments]);

  const handleProposeFixes = async () => {
    if (!sessionId || openComments.length === 0 || spawning) return;
    setSpawning(true);
    try {
      const prompt = buildNotesPrompt(openComments);
      // Resolver is the right kind for "fix these local diff notes": it
      // commits locally, never pushes, and is scoped to the comment(s) in
      // the kickoff. Reviewer would only describe the fix, not apply it.
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
    if (!sessionId) return;
    await selectAgent(sessionId, agentId);
    onClose();
  };

  const handleOpenInEditor = async () => {
    if (!selected || !workingDir) return;
    const root = workingDir.replace(/\/$/, '');
    const absPath = `${root}/${selected.path}`;
    try {
      await openFileInWorkspace(root, absPath, editorBinary);
    } catch {
      // swallow, error surfaced via console
    }
  };

  const handleAddComment = async (anchor: DiffCommentAnchor, body: string) => {
    if (!selected || !sessionId) return;
    await addDiffComment(sessionId, selected.path, body, anchor);
    setActiveAnchor(null);
  };

  const handleAddFileLevelComment = async (body: string) => {
    if (!selected || !sessionId) return;
    await addDiffComment(sessionId, selected.path, body);
    setFileLevelComposerOpen(false);
  };

  const handleSelectFile = (idx: number) => {
    setSelectedIdx(idx);
    setFileLevelComposerOpen(false);
    setActiveAnchor(null);
  };

  const handleRailFileComment = (idx: number) => {
    setSelectedIdx(idx);
    setActiveAnchor(null);
    setFileLevelComposerOpen(true);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      fixedHeightClass="h-[92vh] max-w-[1400px]"
      className="w-[92vw] max-w-[1400px]"
      showClose={false}
      bodyClassName=""
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- dialog handles keyboard nav */}
      <div className="flex h-full min-h-0 flex-col" onKeyDown={handleKeyDown}>
        {isGitAware ? (
          <GitStatusHeader
            status={status}
            onRefresh={() => setRefreshTick((t) => t + 1)}
            refreshing={loading}
          />
        ) : null}
        <Toolbar
          title={title}
          prNumber={prNumber}
          selected={selected}
          filesCount={files.length}
          openCommentsCount={comments.filter((c) => c.status === 'open').length}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          canOpenEditor={Boolean(selected && workingDir)}
          onOpenInEditor={() => void handleOpenInEditor()}
          onPrev={() => setSelectedIdx((i) => Math.max(i - 1, 0))}
          onNext={() => setSelectedIdx((i) => Math.min(i + 1, files.length - 1))}
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
            <div className="flex flex-1 items-center justify-center text-xs text-danger">
              {error}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-full bg-success/10 ring-1 ring-success/20"
              >
                <CheckCircle2 size={26} className="text-success" />
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
              {!sidebarCollapsed ? (
                <FileRail
                  files={files}
                  selectedIdx={selectedIdx}
                  onSelect={handleSelectFile}
                  onStartFileComment={sessionId ? handleRailFileComment : undefined}
                  commentCounts={openCommentsByFile}
                />
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {selected ? (
                  <FileDiffPane
                    key={selected.path}
                    file={selected}
                    comments={selectedComments}
                    fileLevelComments={fileLevelComments}
                    activeAnchor={activeAnchor}
                    fileLevelComposerOpen={fileLevelComposerOpen}
                    canComment={Boolean(sessionId)}
                    onStartComment={(anchor) => setActiveAnchor(anchor)}
                    onCancelComment={() => setActiveAnchor(null)}
                    onSubmitComment={(anchor, body) => void handleAddComment(anchor, body)}
                    onStartFileLevelComment={() => setFileLevelComposerOpen(true)}
                    onCancelFileLevelComment={() => setFileLevelComposerOpen(false)}
                    onSubmitFileLevelComment={(body) => void handleAddFileLevelComment(body)}
                    onResolve={(id) => sessionId && void resolveDiffComment(sessionId, id)}
                    onReopen={(id) => sessionId && void reopenDiffComment(sessionId, id)}
                    onDelete={(id) => sessionId && void deleteDiffComment(sessionId, id)}
                    onViewAgent={(id) => void handleViewAgent(id)}
                    getAgentName={(id) => agentNameById.get(id)}
                  />
                ) : null}
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
    </Dialog>
  );
};

type GitStatusHeaderProps = {
  status: WorktreeStatus | null;
  onRefresh: () => void;
  refreshing: boolean;
};

function GitStatusHeader({ status, onRefresh, refreshing }: GitStatusHeaderProps) {
  const headLabel = status?.head ? status.head.slice(0, 7) : null;
  const subject = status?.headSubject ?? null;
  const counts: string[] = [];
  if (status) {
    if (status.unstaged > 0) counts.push(`${status.unstaged} unstaged`);
    if (status.staged > 0) counts.push(`${status.staged} staged`);
    if (status.untracked > 0) counts.push(`${status.untracked} untracked`);
    if (status.hasUpstream) {
      counts.push(`ahead ${status.ahead} / behind ${status.behind}`);
    } else if (status.branch) {
      counts.push('no upstream');
    }
  }
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-soft bg-subtle/30 px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5 text-xs">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            HEAD
          </span>
          {headLabel ? (
            <span className="shrink-0 font-mono text-foreground">{headLabel}</span>
          ) : (
            <span className="shrink-0 italic text-muted-foreground/60">no commit</span>
          )}
          {subject ? (
            <span className="min-w-0 truncate text-muted-foreground" title={subject}>
              {subject}
            </span>
          ) : null}
        </div>
        <div className="text-[11px] text-muted-foreground/70">
          {status?.branch ? <span className="mr-2 font-mono">{status.branch}</span> : null}
          {counts.length > 0 ? counts.join(' · ') : 'clean'}
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        title="refresh git state"
        aria-label="refresh git state"
        className={cn(TOOLBAR_ICON_BTN, 'mt-0.5 disabled:opacity-50')}
      >
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} aria-hidden />
      </button>
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
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-subtle/30 px-4 py-2.5">
      <span className="text-xs text-muted-foreground">
        {openCount} open {openCount === 1 ? 'note' : 'notes'} · spawn a reviewer to propose fixes
      </span>
      <button
        type="button"
        onClick={onPropose}
        disabled={spawning}
        className="inline-flex items-center gap-1.5 rounded-sm border border-info/30 bg-info/5 px-2.5 py-1 text-xs font-medium text-info hover:bg-info/10 disabled:opacity-50"
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

type ToolbarProps = {
  title?: string;
  prNumber?: number;
  selected: FileDiff | undefined;
  filesCount: number;
  openCommentsCount: number;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  canOpenEditor: boolean;
  onOpenInEditor: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  viewSelector?: React.ReactNode;
};

function Toolbar({
  title,
  prNumber,
  selected,
  filesCount,
  openCommentsCount,
  sidebarCollapsed,
  onToggleSidebar,
  canOpenEditor,
  onOpenInEditor,
  onPrev,
  onNext,
  onClose,
  viewSelector,
}: ToolbarProps) {
  const titleText = title ?? (prNumber !== undefined ? `pr #${prNumber} diff` : 'diff');
  return (
    <div className="flex shrink-0 items-center gap-2 px-3 py-2">
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
        {viewSelector ? (
          viewSelector
        ) : (
          <span className="shrink-0 text-xs font-semibold tracking-tight text-foreground">
            {titleText}
          </span>
        )}
        {selected ? (
          <>
            <ChevronsRight size={11} aria-hidden className="shrink-0 text-muted-foreground/40" />
            <span
              className={cn(
                'shrink-0 w-3 text-center font-mono font-bold text-[11px]',
                STATUS_COLOR[selected.status],
              )}
              title={selected.status}
            >
              {STATUS_GLYPH[selected.status]}
            </span>
            <span
              className="min-w-0 truncate font-mono text-xs text-muted-foreground"
              title={selected.path}
            >
              {selected.path}
            </span>
          </>
        ) : viewSelector ? null : (
          <span className="text-xs text-muted-foreground">
            {filesCount} {filesCount === 1 ? 'file' : 'files'}
          </span>
        )}
        {openCommentsCount > 0 ? (
          <span
            className="ml-1 shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning"
            title={`${openCommentsCount} open ${openCommentsCount === 1 ? 'note' : 'notes'}`}
          >
            {openCommentsCount} {openCommentsCount === 1 ? 'note' : 'notes'}
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
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
          onClick={onPrev}
          title="previous file (k)"
          aria-label="previous file"
          className={TOOLBAR_ICON_BTN}
        >
          <ChevronLeft size={13} />
        </button>
        <button
          type="button"
          onClick={onNext}
          title="next file (j)"
          aria-label="next file"
          className={TOOLBAR_ICON_BTN}
        >
          <ChevronRight size={13} />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="close"
          aria-label="close"
          className={cn('ml-1', TOOLBAR_ICON_BTN)}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

function FileRail({
  files,
  selectedIdx,
  onSelect,
  onStartFileComment,
  commentCounts,
}: {
  files: ReadonlyArray<FileDiff>;
  selectedIdx: number;
  onSelect: (i: number) => void;
  onStartFileComment?: (i: number) => void;
  commentCounts: Map<string, number>;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const tree = useMemo(() => buildTree(files), [files]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  return (
    <ScrollArea className="w-[26%] shrink-0 overflow-y-auto border-r border-border-soft bg-subtle/20">
      <div className="py-1">
        {tree.kind === 'dir' &&
          tree.children.map((child, i) => (
            <TreeNodeView
              key={`${child.kind}-${child.name}-${i}`}
              node={child}
              depth={0}
              selectedIdx={selectedIdx}
              onSelect={onSelect}
              onStartFileComment={onStartFileComment}
              selectedRef={selectedRef}
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
  selectedIdx,
  onSelect,
  onStartFileComment,
  selectedRef,
  commentCounts,
}: {
  node: TreeNode;
  depth: number;
  selectedIdx: number;
  onSelect: (i: number) => void;
  onStartFileComment?: (i: number) => void;
  selectedRef: React.RefObject<HTMLButtonElement | null>;
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
    const { file, index } = node;
    const isSelected = index === selectedIdx;
    const noteCount = commentCounts.get(file.path) ?? 0;
    return (
      <div
        className={cn(
          'group relative flex w-full items-center gap-2 py-1 pr-1 font-mono text-xs transition-colors',
          isSelected
            ? 'border-l-2 border-primary bg-subtle text-foreground'
            : 'border-l-2 border-transparent text-muted-foreground/80 hover:bg-muted/30 hover:text-foreground',
        )}
        style={{ paddingLeft: 10 + indent }}
      >
        <button
          ref={isSelected ? selectedRef : null}
          type="button"
          onClick={() => onSelect(index)}
          title={file.path}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={cn(
              'w-3 shrink-0 text-center text-[10px] font-bold',
              STATUS_COLOR[file.status],
            )}
          >
            {STATUS_GLYPH[file.status]}
          </span>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {noteCount > 0 ? (
            <span className="shrink-0 rounded-full bg-warning/15 px-1 text-[9px] font-medium text-warning">
              {noteCount}
            </span>
          ) : null}
          <span className="shrink-0 text-[10px] tabular-nums">
            {file.additions > 0 ? <span className="text-success">+{file.additions}</span> : null}
            {file.additions > 0 && file.deletions > 0 ? (
              <span className="opacity-40"> </span>
            ) : null}
            {file.deletions > 0 ? <span className="text-danger">−{file.deletions}</span> : null}
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
        {onStartFileComment ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartFileComment(index);
            }}
            title="add file-level note"
            aria-label="add file-level note"
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <MessageSquarePlus size={10} aria-hidden />
          </button>
        ) : null}
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
      </button>
      {expanded
        ? node.children.map((child, i) => (
            <TreeNodeView
              key={`${child.kind}-${child.name}-${i}`}
              node={child}
              depth={depth + 1}
              selectedIdx={selectedIdx}
              onSelect={onSelect}
              onStartFileComment={onStartFileComment}
              selectedRef={selectedRef}
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
  return (
    <div
      className={cn('group flex flex-col gap-1 rounded-md border-l-2 px-3 py-1.5', containerClass)}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
          {comment.status === 'resolved' ? (
            <span className="line-through">{comment.body}</span>
          ) : (
            comment.body
          )}
        </p>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {comment.status === 'open' ? (
            <button
              type="button"
              onClick={() => onResolve(comment.id)}
              title="mark resolved"
              aria-label="resolve"
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-success"
            >
              <Check size={11} />
            </button>
          ) : null}
          {comment.status === 'consumed' ? (
            <button
              type="button"
              onClick={() => onReopen(comment.id)}
              title="reopen note"
              aria-label="reopen"
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-warning"
            >
              <RotateCcw size={11} />
            </button>
          ) : null}
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
      {comment.status === 'consumed' ? (
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
      ) : null}
    </div>
  );
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

type FileDiffPaneProps = {
  file: FileDiff;
  comments: ReadonlyArray<DiffComment>;
  fileLevelComments: ReadonlyArray<DiffComment>;
  activeAnchor: DiffCommentAnchor | null;
  fileLevelComposerOpen: boolean;
  canComment: boolean;
  onStartComment: (anchor: DiffCommentAnchor) => void;
  onCancelComment: () => void;
  onSubmitComment: (anchor: DiffCommentAnchor, body: string) => void;
  onStartFileLevelComment: () => void;
  onCancelFileLevelComment: () => void;
  onSubmitFileLevelComment: (body: string) => void;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
  onViewAgent: (agentId: AgentId) => void;
  getAgentName: (agentId: AgentId) => string | undefined;
};

function FileDiffPane({
  file,
  comments,
  fileLevelComments,
  activeAnchor,
  fileLevelComposerOpen,
  canComment,
  onStartComment,
  onCancelComment,
  onSubmitComment,
  onStartFileLevelComment,
  onCancelFileLevelComment,
  onSubmitFileLevelComment,
  onResolve,
  onReopen,
  onDelete,
  onViewAgent,
  getAgentName,
}: FileDiffPaneProps) {
  const commentsByAnchor = useMemo(() => {
    const m = new Map<string, DiffComment[]>();
    for (const c of comments) {
      if (!c.anchor) continue;
      const k = anchorKey(c.anchor);
      const arr = m.get(k);
      if (arr) arr.push(c);
      else m.set(k, [c]);
    }
    return m;
  }, [comments]);

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
    if (visibleLines >= totalLines) return rows;
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.type === 'line') {
        count += 1;
        if (count >= visibleLines) return rows.slice(0, i + 1);
      }
    }
    return rows;
  }, [rows, visibleLines, totalLines]);

  const remaining = Math.max(0, totalLines - visibleLines);

  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className="p-3">
        {fileLevelComments.length > 0 || fileLevelComposerOpen ? (
          <div className="mb-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                file notes
              </span>
              {canComment && !fileLevelComposerOpen ? (
                <button
                  type="button"
                  onClick={onStartFileLevelComment}
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
                onSubmit={onSubmitFileLevelComment}
                onCancel={onCancelFileLevelComment}
              />
            ) : null}
          </div>
        ) : canComment ? (
          <div className="mb-3">
            <button
              type="button"
              onClick={onStartFileLevelComment}
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
            <table className="w-full border-collapse font-mono text-xs leading-5">
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
                  return (
                    <Fragment key={`hunk-${hi}-line-${li}`}>
                      <tr
                        className={cn(
                          'group',
                          line.kind === 'add' && 'bg-success/10',
                          line.kind === 'del' && 'bg-danger/10',
                        )}
                      >
                        <td className="w-6 select-none px-0.5 align-top">
                          {canComment && anchor ? (
                            <button
                              type="button"
                              onClick={() => onStartComment(anchor)}
                              title="add comment on this line"
                              aria-label="add comment on this line"
                              className={cn(
                                'flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
                                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
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
                      {lineComments.length > 0 ? (
                        <tr>
                          <td colSpan={4} className="bg-background px-3 py-2">
                            <div className="flex flex-col gap-1.5">
                              {lineComments.map((c) => (
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
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {isActive && anchor ? (
                        <tr>
                          <td colSpan={4} className="bg-background px-3 py-2">
                            <InlineComposer
                              onSubmit={(body) => onSubmitComment(anchor, body)}
                              onCancel={onCancelComment}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {remaining > 0 ? (
              <ShowMoreBar
                step={Math.min(VISIBLE_LINES_STEP, remaining)}
                rendered={Math.min(visibleLines, totalLines)}
                total={totalLines}
                onShowMore={() => setVisibleLines((n) => n + VISIBLE_LINES_STEP)}
              />
            ) : null}
          </>
        )}
      </div>
    </ScrollArea>
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
    <div className="flex flex-col items-center gap-1 border-t border-border-soft bg-subtle/30 py-3">
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
}: {
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState('');
  const trimmed = body.trim();
  return (
    <div className="flex gap-2 rounded-md border border-border-soft bg-background px-2 py-1.5 shadow-sm">
      <MessageSquarePlus size={13} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
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
              if (trimmed.length > 0) onSubmit(trimmed);
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
