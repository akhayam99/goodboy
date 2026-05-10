import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  History,
  RotateCcw,
  GitPullRequest,
  GitPullRequestDraft,
  GitMerge,
  RefreshCw,
  ExternalLink,
  Plus,
  Loader2,
  Copy,
  X,
} from 'lucide-react';
import { ScrollArea, Textarea, Dialog, Button, cn } from '@kay-am/ui';
import { SLOT_KEYS, SLOT_LABELS, type SlotKey, detectRepoSlug } from '@kay-am/core';
import type {
  ContextSlot,
  ContextSlotHistoryEntry,
  Task,
  TaskId,
  TelemetryRecord,
  PullRequestStateKind,
} from '@kay-am/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionSlots,
  useSlotHistory,
  useSummarizerStatus,
} from '../store';
import { openUrl } from '../editor';
import { tauriGhRunner } from '../github';
import { DiffViewerDialog } from './DiffViewerDialog';

interface ContextPanelProps {
  session: Task;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}

type SummarizerStatusKind = 'idle' | 'running' | 'error';

export function ContextPanel({
  session,
  collapsed = false,
  onCollapse,
  onExpand,
}: ContextPanelProps) {
  const slots = useSessionSlots(session.id);
  const summarizer = useSummarizerStatus(session.id);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const sessionTelemetry = useAppStore(
    (s) => s.sessionTelemetry[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );

  const summarizerTotals = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;
    let count = 0;
    for (const rec of sessionTelemetry) {
      if (rec.kind !== 'summarizer') continue;
      inputTokens += rec.inputTokens;
      outputTokens += rec.outputTokens;
      estimatedCostUsd += rec.estimatedCostUsd;
      count += 1;
    }
    return { inputTokens, outputTokens, estimatedCostUsd, count };
  }, [sessionTelemetry]);

  const slotsByKey = new Map<string, ContextSlot>(slots.map((s) => [s.key, s]));

  if (collapsed) {
    return (
      <div className="flex h-full w-full justify-end pr-4 pt-4">
        <button
          type="button"
          onClick={onExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExpand?.();
            }
          }}
          title="expand context panel"
          aria-label="expand context panel"
          className={cn(
            'h-fit rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          )}
        >
          <PanelRightOpen size={13} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            context
          </span>
          <div className="flex items-center gap-1">
            <SummarizerBadge
              status={summarizer.status}
              lastUpdate={summarizer.lastUpdate}
              error={summarizer.error}
              totals={summarizerTotals}
            />
            {onCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                title="hide context panel"
                aria-label="hide context panel"
                className="rounded-sm p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <PanelRightClose size={13} aria-hidden />
              </button>
            ) : null}
          </div>
        </header>

        <GitHubSection session={session} />

        <ul className="flex flex-col gap-4">
          {SLOT_KEYS.map((key) => {
            const slot = slotsByKey.get(key);
            return (
              <SlotRow
                key={key}
                taskId={session.id}
                slotKey={key}
                slot={slot}
                onCommit={(value) => void upsertSessionSlot(session.id, key, value)}
              />
            );
          })}
        </ul>
      </div>
    </ScrollArea>
  );
}

const PR_STATE_LABEL: Record<PullRequestStateKind, string> = {
  draft: 'draft',
  open: 'open',
  approved: 'approved',
  merged: 'merged',
  closed: 'closed',
};

const PR_STATE_STYLE: Record<PullRequestStateKind, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-success/10 text-success',
  approved: 'bg-success/20 text-success',
  merged: 'bg-accent/10 text-accent',
  closed: 'bg-danger/10 text-danger',
};

function PrStateIcon({ state }: { state: PullRequestStateKind }) {
  if (state === 'draft') return <GitPullRequestDraft size={11} aria-hidden />;
  if (state === 'merged') return <GitMerge size={11} aria-hidden />;
  return <GitPullRequest size={11} aria-hidden />;
}

function openInBrowser(url: string) {
  openUrl(url).catch(() => window.open(url, '_blank'));
}

function GitHubSection({ session }: { session: Task }) {
  const githubStatus = useAppStore((s) => s.githubStatus);
  const branch = useAppStore((s) => s.sessionBranches[session.id]);
  const ghState = useAppStore((s) => s.sessionGithub[session.id]);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === session.workspaceId));
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const createPrForSession = useAppStore((s) => s.createPrForSession);

  const [repoSlug, setRepoSlug] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!branch || !workspace?.rootPath) return;
    detectRepoSlug(tauriGhRunner, workspace.rootPath)
      .then(setRepoSlug)
      .catch(() => setRepoSlug(null));
  }, [branch, workspace?.rootPath]);

  useEffect(() => {
    if (!branch || githubStatus?.mode === 'absent') return;
    void refreshSessionPr(session.id);
  }, [branch, githubStatus?.mode, session.id, refreshSessionPr]);

  if (!branch || githubStatus?.mode === 'absent') return null;

  const pr = ghState?.pr ?? null;
  const linkedIssues = ghState?.linkedIssues ?? [];
  const loading = ghState?.loading ?? false;
  const ISSUE_LIMIT = 3;
  const visibleIssues = issuesExpanded ? linkedIssues : linkedIssues.slice(0, ISSUE_LIMIT);
  const hiddenCount = linkedIssues.length - ISSUE_LIMIT;

  const copyBranch = () => {
    navigator.clipboard.writeText(branch).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleCreatePr = async () => {
    setCreateError(null);
    try {
      await createPrForSession(session.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          github
        </span>
        <button
          type="button"
          onClick={() => void refreshSessionPr(session.id, { force: true })}
          disabled={loading}
          title="refresh pr status"
          aria-label="refresh pr status"
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw size={11} className={cn(loading && 'animate-spin')} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle px-2.5 py-2">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate font-mono text-xs text-foreground" title={branch}>
            {branch}
          </span>
          <button
            type="button"
            onClick={copyBranch}
            title="copy branch name"
            aria-label="copy branch name"
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {copied ? <X size={10} aria-hidden /> : <Copy size={10} aria-hidden />}
          </button>
        </div>

        {pr ? (
          <div className="flex items-start gap-1.5">
            <button
              type="button"
              onClick={() => openInBrowser(pr.url)}
              className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs text-foreground hover:underline"
              title={pr.title}
            >
              <PrStateIcon state={pr.state} />
              <span className="truncate">
                #{pr.number} {pr.title}
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                  PR_STATE_STYLE[pr.state],
                )}
              >
                {PR_STATE_LABEL[pr.state]}
              </span>
              {repoSlug ? (
                <button
                  type="button"
                  onClick={() => setDiffOpen(true)}
                  title="view diff"
                  aria-label="view pr diff"
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink size={10} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 size={10} className="animate-spin" aria-hidden />
            checking…
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-xs italic text-muted-foreground">no pr yet</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleCreatePr()}
              disabled={loading}
              className="h-5 gap-0.5 px-1.5 text-[10px]"
            >
              <Plus size={10} aria-hidden />
              open pr
            </Button>
          </div>
        )}

        {linkedIssues.length > 0 ? (
          <div className="flex flex-col gap-0.5 border-t border-border-soft pt-1.5">
            {visibleIssues.map((issue) => (
              <div key={issue.number} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'shrink-0 rounded-sm px-1 py-0.5 text-[9px] uppercase tracking-wide',
                    issue.closes ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {issue.closes ? 'closes' : 'ref'}
                </span>
                <button
                  type="button"
                  onClick={() => openInBrowser(issue.url)}
                  className="min-w-0 flex-1 truncate text-left text-xs text-muted-foreground hover:text-foreground hover:underline"
                  title={issue.title ?? `#${issue.number}`}
                >
                  #{issue.number}
                  {issue.title ? ` ${issue.title}` : ''}
                </button>
              </div>
            ))}
            {!issuesExpanded && hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setIssuesExpanded(true)}
                className="self-start text-[10px] text-muted-foreground hover:text-foreground"
              >
                +{hiddenCount} more
              </button>
            ) : issuesExpanded && hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setIssuesExpanded(false)}
                className="self-start text-[10px] text-muted-foreground hover:text-foreground"
              >
                show less
              </button>
            ) : null}
          </div>
        ) : null}

        {createError ? (
          <p className="rounded border border-danger/30 bg-danger/10 px-2 py-1 text-[10px] text-danger">
            {createError}
          </p>
        ) : null}
      </div>

      {repoSlug && pr ? (
        <DiffViewerDialog
          open={diffOpen}
          onClose={() => setDiffOpen(false)}
          repoSlug={repoSlug}
          prNumber={pr.number}
          cwd={workspace?.rootPath}
        />
      ) : null}
    </section>
  );
}

interface SlotRowProps {
  taskId: TaskId;
  slotKey: SlotKey;
  slot: ContextSlot | undefined;
  onCommit: (value: string) => void;
}

function SlotRow({ taskId, slotKey, slot, onCommit }: SlotRowProps) {
  const value = slot?.value ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const history = useSlotHistory(taskId, slotKey);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const openHistory = useCallback(() => {
    void loadSlotHistory(taskId, slotKey);
    setHistoryOpen(true);
  }, [loadSlotHistory, taskId, slotKey]);

  const restore = useCallback(
    (entry: ContextSlotHistoryEntry) => {
      onCommit(entry.value);
      setHistoryOpen(false);
    },
    [onCommit],
  );

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {SLOT_LABELS[slotKey]}
        </label>
        <button
          type="button"
          onClick={openHistory}
          title="view history"
          aria-label={`view history for ${SLOT_LABELS[slotKey]}`}
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <History size={11} aria-hidden />
        </button>
      </div>

      {editing ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(value);
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          className="text-xs"
          autoGrow
          maxRows={12}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="whitespace-pre-wrap rounded-md border border-transparent bg-subtle px-2.5 py-2 text-left text-xs leading-relaxed hover:border-border-soft hover:bg-muted/40"
        >
          {value.length > 0 ? (
            value
          ) : (
            <span className="italic text-muted-foreground">empty — click to edit</span>
          )}
        </button>
      )}

      <SlotHistoryDialog
        label={SLOT_LABELS[slotKey]}
        open={historyOpen}
        entries={history}
        onRestore={restore}
        onClose={() => setHistoryOpen(false)}
      />
    </li>
  );
}

interface SlotHistoryDialogProps {
  label: string;
  open: boolean;
  entries: ReadonlyArray<ContextSlotHistoryEntry>;
  onRestore: (entry: ContextSlotHistoryEntry) => void;
  onClose: () => void;
}

function SlotHistoryDialog({ label, open, entries, onRestore, onClose }: SlotHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`history — ${label}`} size="xl">
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">no history yet</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide',
                    entry.author === 'user' ? 'bg-accent/10 text-accent' : 'bg-info/10 text-info',
                  )}
                >
                  {entry.author === 'user' ? 'you' : 'ai'}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {formatRelative(entry.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  title="restore this version"
                  aria-label="restore"
                  className="ml-auto flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw size={10} aria-hidden />
                  restore
                </button>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground line-clamp-4">
                {entry.value}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SummarizerBadge({
  status,
  lastUpdate,
  error,
  totals,
}: {
  status: SummarizerStatusKind;
  lastUpdate: string | null;
  error: string | null;
  totals: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
    readonly count: number;
  };
}) {
  if (status === 'idle') {
    if (totals.count === 0 || totals.estimatedCostUsd <= 0) return null;
    const tooltip = `summary total · ${totals.count} run${totals.count === 1 ? '' : 's'} · ${totals.inputTokens} in / ${totals.outputTokens} out · $${totals.estimatedCostUsd.toFixed(4)}${lastUpdate ? ` · last ${lastUpdate}` : ''}`;
    return (
      <span
        title={tooltip}
        className="rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground"
      >
        Σ ${totals.estimatedCostUsd.toFixed(4)}
      </span>
    );
  }
  const styles: Record<Exclude<SummarizerStatusKind, 'idle'>, string> = {
    running: 'bg-info/10 text-info',
    error: 'bg-danger/10 text-danger',
  };
  const labels: Record<Exclude<SummarizerStatusKind, 'idle'>, string> = {
    running: 'summarizing…',
    error: 'error',
  };
  const tooltip =
    status === 'error' && error
      ? `last error: ${error}`
      : lastUpdate
        ? `last update: ${lastUpdate}`
        : 'summarizer running — keep typing, the app is not blocked';
  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide',
        styles[status],
      )}
    >
      {status === 'running' ? (
        <span className="flex gap-0.5" aria-hidden>
          <span className="h-1 w-1 animate-pulse rounded-full bg-info [animation-delay:0ms]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-info [animation-delay:150ms]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-info [animation-delay:300ms]" />
        </span>
      ) : null}
      {labels[status]}
    </span>
  );
}
