import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  History,
  RotateCcw,
  GitBranch,
  GitPullRequest,
  GitPullRequestDraft,
  GitMerge,
  RefreshCw,
  Plus,
  Loader2,
  ChevronRight,
  ChevronDown,
  FileEdit,
  Target,
  CheckCheck,
  HelpCircle,
  Activity,
  ClipboardList,
  List,
  type LucideIcon,
} from 'lucide-react';
import { ScrollArea, Textarea, Dialog, Button, Markdown, cn } from '@kay-am/ui';
import { SLOT_KEYS, SLOT_LABELS, type SlotKey, detectRepoSlug } from '@kay-am/core';
import type {
  ContextSlot,
  ContextSlotHistoryEntry,
  PlanStatus,
  PlanWithCount,
  PrComment,
  Session,
  SessionId,
  TelemetryRecord,
  PullRequestStateKind,
} from '@kay-am/types';
import { PlansModal } from './PlansModal';
import {
  EMPTY_ARRAY,
  useAppStore,
  useDiffComments,
  useFilesTouched,
  useSessionLoading,
  useSessionPlans,
  useSessionSlots,
  useSlotHistory,
  useSummarizerStatus,
} from '../store';
import { openUrl } from '../editor';
import { formatError } from '../errors';
import { tauriGhRunner } from '../github';
import { DiffViewerDialog } from './DiffViewerDialog';
import { GithubCard } from './GithubCard';
import { worktreeStatus } from '../worktree';
import type { WorktreeStatus } from '@kay-am/types';
import { buildCommentAgentArgs, buildReviewChangesAgentArgs } from '../spawn-from-comment';

interface ContextPanelProps {
  session: Session;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  // Keep-alive aware: false when this panel is mounted but hidden behind
  // another session. Effects that touch DB or network gate on this so
  // background panels don't churn.
  isActive?: boolean;
}

type SummarizerStatusKind = 'idle' | 'running' | 'error';

const ICON_BTN =
  'rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground' as const;

export function ContextPanel({
  session,
  collapsed = false,
  onCollapse,
  onExpand,
  isActive = true,
}: ContextPanelProps) {
  const slots = useSessionSlots(session.id);
  const summarizer = useSummarizerStatus(session.id);
  const loading = useSessionLoading(session.id);
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

  const workingDir = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);

  const slotsByKey = new Map<string, ContextSlot>(
    slots.map((s) => [s.key, s.key === 'files_touched' ? normalizeFilesSlot(s, workingDir) : s]),
  );

  const visibleSlotKeys = useMemo(
    () =>
      SLOT_KEYS.filter((k) => k !== 'files_touched').sort((a, b) => {
        const order: Record<string, number> = {
          goal: 0,
          open_questions: 1,
          decisions: 2,
          last_output_summary: 3,
        };
        return (order[a] ?? 99) - (order[b] ?? 99);
      }),
    [],
  );

  const filesTouched = useFilesTouched(session.id);
  const [gitStatus, setGitStatus] = useState<WorktreeStatus | null>(null);

  useEffect(() => {
    if (!workingDir) {
      setGitStatus(null);
      return;
    }
    let cancelled = false;
    worktreeStatus(workingDir)
      .then((s) => {
        if (!cancelled) setGitStatus(s);
      })
      .catch(() => {
        if (!cancelled) setGitStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workingDir, filesTouched.count, summarizer.lastUpdate]);

  const filesTouchedCount = gitStatus?.changed ?? filesTouched.count;
  const filesTooltip = useMemo(() => {
    if (!gitStatus) {
      return filesTouchedCount === 0
        ? 'no files touched yet'
        : `view diff for ${filesTouchedCount} file${filesTouchedCount === 1 ? '' : 's'}`;
    }
    const parts: string[] = [];
    if (gitStatus.unstaged > 0) parts.push(`${gitStatus.unstaged} unstaged`);
    if (gitStatus.staged > 0) parts.push(`${gitStatus.staged} staged`);
    if (gitStatus.untracked > 0) parts.push(`${gitStatus.untracked} untracked`);
    if (gitStatus.hasUpstream && (gitStatus.ahead > 0 || gitStatus.behind > 0)) {
      parts.push(`ahead ${gitStatus.ahead} / behind ${gitStatus.behind}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'working tree clean';
  }, [gitStatus, filesTouchedCount]);

  const [filesDiffOpen, setFilesDiffOpen] = useState(false);
  const [filesDiffJumpToNotes, setFilesDiffJumpToNotes] = useState(false);
  const diffComments = useDiffComments(session.id);
  const openNotesCount = useMemo(
    () => diffComments.filter((c) => c.status === 'open').length,
    [diffComments],
  );
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);

  useEffect(() => {
    if (!isActive) return;
    const t0 = performance.now();
    void loadDiffComments(session.id).finally(() => {
      // eslint-disable-next-line no-console
      console.log(`[perf] ctx:diffComments ${(performance.now() - t0).toFixed(0)}ms`);
    });
  }, [isActive, session.id, loadDiffComments]);

  return (
    <>
      <div className={cn('flex h-full w-full justify-end pr-4 pt-4', !collapsed && 'hidden')}>
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
            'h-fit',
            ICON_BTN,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          )}
        >
          <PanelRightOpen size={13} aria-hidden />
        </button>
      </div>

      <div className={cn('flex h-full min-h-0 flex-col', collapsed && 'hidden')}>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
            <header className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                CONTEXT
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
                    className={ICON_BTN}
                  >
                    <PanelRightClose size={13} aria-hidden />
                  </button>
                ) : null}
              </div>
            </header>

            <PlansSection sessionId={session.id} />

            {/* Per-slot independence: <ul> is always rendered. Each SlotRow
                shows its own skeleton when its data slice is missing AND the
                slots fetch is in flight. One slot finishing first paints
                without waiting for siblings. */}
            <ul className="flex flex-col gap-6">
              {visibleSlotKeys.map((key) => {
                const slot = slotsByKey.get(key);
                return (
                  <SlotRow
                    key={key}
                    sessionId={session.id}
                    slotKey={key}
                    slot={slot}
                    loading={loading.slots}
                    isSummarizing={summarizer.status === 'running'}
                    onCommit={(value) => void upsertSessionSlot(session.id, key, value)}
                  />
                );
              })}
            </ul>
          </div>
        </ScrollArea>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border-soft px-3 py-3">
          <GitHubSection session={session} isActive={isActive} />
          {filesTouchedCount === 0 && (loading.transcript || loading.agents) ? (
            <FilesTouchedSkeleton />
          ) : (
            <button
              type="button"
              onClick={() => {
                setFilesDiffJumpToNotes(false);
                setFilesDiffOpen(true);
              }}
              disabled={!workingDir}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                !workingDir
                  ? 'cursor-not-allowed text-muted-foreground/50'
                  : filesTouchedCount === 0
                    ? 'border border-border-soft text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                    : 'border border-info/20 bg-info/5 text-info hover:bg-info/10',
              )}
              title={filesTooltip}
            >
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FileEdit size={11} aria-hidden />
                <span className="truncate">
                  {filesTouchedCount} file{filesTouchedCount === 1 ? '' : 's'} touched
                </span>
                {openNotesCount > 0 ? (
                  <>
                    <span aria-hidden className="opacity-40">
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilesDiffJumpToNotes(true);
                        setFilesDiffOpen(true);
                      }}
                      className="shrink-0 rounded-sm px-1 text-warning hover:bg-warning/10"
                      title={`jump to ${openNotesCount} open note${openNotesCount === 1 ? '' : 's'}`}
                    >
                      {openNotesCount} note{openNotesCount === 1 ? '' : 's'}
                    </button>
                  </>
                ) : null}
              </span>
              <span aria-hidden className="opacity-60">
                ↗
              </span>
            </button>
          )}
        </div>
      </div>

      <DiffViewerDialog
        open={filesDiffOpen}
        onClose={() => setFilesDiffOpen(false)}
        sessionId={session.id}
        title={`${filesTouchedCount} file${filesTouchedCount === 1 ? '' : 's'} touched`}
        workingDir={workingDir ?? undefined}
        worktreePath={workingDir ?? undefined}
        jumpToFirstCommented={filesDiffJumpToNotes}
      />
    </>
  );
}

const PR_STATE_LABEL: Record<PullRequestStateKind, string> = {
  draft: 'draft',
  open: 'open',
  approved: 'approved',
  merged: 'merged',
  closed: 'closed',
};

const PR_STATE_ICON_CLASS: Record<PullRequestStateKind, string> = {
  draft: 'text-muted-foreground',
  open: 'text-success',
  approved: 'text-success',
  merged: 'text-accent',
  closed: 'text-danger',
};

function PrStateIcon({ state, size = 12 }: { state: PullRequestStateKind; size?: number }) {
  const cls = PR_STATE_ICON_CLASS[state];
  if (state === 'draft') return <GitPullRequestDraft size={size} aria-hidden className={cls} />;
  if (state === 'merged') return <GitMerge size={size} aria-hidden className={cls} />;
  return <GitPullRequest size={size} aria-hidden className={cls} />;
}

function openInBrowser(url: string) {
  openUrl(url).catch(() => window.open(url, '_blank'));
}

function SlotSkeleton({ emphasis }: { emphasis?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md px-2.5 py-2 bg-subtle',
        emphasis ? 'gap-2.5' : 'gap-1.5',
      )}
      aria-hidden
    >
      <div
        className={cn(
          'animate-pulse rounded bg-muted/70',
          emphasis ? 'h-3.5 w-3/4' : 'h-2.5 w-4/5',
        )}
      />
      <div
        className={cn(
          'animate-pulse rounded bg-muted/70',
          emphasis ? 'h-3.5 w-full' : 'h-2.5 w-full',
        )}
      />
      <div
        className={cn(
          'animate-pulse rounded bg-muted/70',
          emphasis ? 'h-3.5 w-1/2' : 'h-2.5 w-2/3',
        )}
      />
    </div>
  );
}

function SlotRowSkeleton({ slotKey }: { slotKey: SlotKey }) {
  return (
    <li role="status" aria-label={`loading ${slotKey}`} className="flex flex-col gap-2">
      <div className="h-2.5 w-20 animate-pulse rounded bg-muted/70" />
      <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-muted/70" />
    </li>
  );
}

function PlansSkeleton() {
  return (
    <div role="status" aria-label="loading plans" className="flex flex-col gap-2 pb-2">
      <div className="h-2.5 w-16 animate-pulse rounded bg-muted/70" />
      <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
    </div>
  );
}

function FilesTouchedSkeleton() {
  return (
    <div
      role="status"
      aria-label="loading files touched"
      className="inline-flex items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-1"
    >
      <div className="h-2.5 w-2.5 animate-pulse rounded-sm bg-muted" />
      <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
    </div>
  );
}

function PrSkeleton() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <div className="h-2.5 w-2.5 animate-pulse rounded-sm bg-muted" />
      <div className="h-2.5 flex-1 animate-pulse rounded bg-muted" />
      <div className="h-4 w-10 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

function GitHubSection({ session, isActive = true }: { session: Session; isActive?: boolean }) {
  const githubStatus = useAppStore((s) => s.githubStatus);
  const branch = useAppStore((s) => s.sessionBranches[session.id]);
  const ghState = useAppStore((s) => s.sessionGithub[session.id]);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === session.workspaceId));
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const createPrForSession = useAppStore((s) => s.createPrForSession);
  const spawnAgent = useAppStore((s) => s.spawnAgent);

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
    if (!isActive) return;
    if (!branch || githubStatus?.mode === 'absent') return;
    if (ghState?.fetchedAt != null) return;
    const t0 = performance.now();
    void refreshSessionPr(session.id).finally(() => {
      // eslint-disable-next-line no-console
      console.log(`[perf] ctx:refreshSessionPr ${(performance.now() - t0).toFixed(0)}ms`);
    });
  }, [isActive, branch, githubStatus?.mode, session.id, ghState?.fetchedAt, refreshSessionPr]);

  const prNumber = ghState?.pr?.number ?? null;
  const prDetailFetchedAt = ghState?.detailFetchedAt ?? null;
  useEffect(() => {
    if (!isActive) return;
    if (prNumber === null) return;
    // Skip when detail was already fetched. Without this guard the GitHub
    // network call (~3s) re-fired on every session switch, leaving a pending
    // PR-card spinner visible for the entire wait.
    if (prDetailFetchedAt !== null) return;
    const t0 = performance.now();
    void refreshSessionPrDetail(session.id).finally(() => {
      // eslint-disable-next-line no-console
      console.log(`[perf] ctx:refreshSessionPrDetail ${(performance.now() - t0).toFixed(0)}ms`);
    });
  }, [isActive, prNumber, prDetailFetchedAt, session.id, refreshSessionPrDetail]);

  if (!branch || githubStatus?.mode === 'absent') return null;

  const pr = ghState?.pr ?? null;
  const linkedIssues = ghState?.linkedIssues ?? [];
  const loading = ghState?.loading ?? false;
  const isFirstLoad = loading && ghState?.fetchedAt == null;
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
      setCreateError(formatError(err));
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <GitBranch size={11} aria-hidden className="text-provider-cursor" />
          github
        </span>
        <button
          type="button"
          onClick={() => void refreshSessionPr(session.id, { force: true })}
          disabled={loading}
          title="refresh pr status"
          aria-label="refresh pr status"
          className={cn(ICON_BTN, 'disabled:opacity-40')}
        >
          <RefreshCw size={11} className={cn(loading && 'animate-spin')} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle px-2.5 py-2">
        {isFirstLoad ? (
          <PrSkeleton />
        ) : pr ? (
          <div
            className="flex items-center gap-1.5"
            title={`#${pr.number} ${pr.title} — ${PR_STATE_LABEL[pr.state]}`}
          >
            <PrStateIcon state={pr.state} />
            <button
              type="button"
              onClick={() => openInBrowser(pr.url)}
              className="shrink-0 font-mono text-xs text-foreground hover:underline focus:underline focus:outline-none"
              title={`open #${pr.number} on github — ${pr.title}`}
              aria-label={`open pull request #${pr.number} on github`}
            >
              #{pr.number}
            </button>
            <button
              type="button"
              onClick={copyBranch}
              className={cn(
                'min-w-0 flex-1 truncate text-left font-mono text-xs transition-colors focus:outline-none',
                copied
                  ? 'text-success'
                  : 'text-muted-foreground hover:text-foreground focus:text-foreground',
              )}
              title={copied ? 'copied!' : `copy branch: ${branch}`}
              aria-label={`copy branch name ${branch}`}
            >
              {branch}
            </button>
            {repoSlug ? (
              <button
                type="button"
                onClick={() => setDiffOpen(true)}
                title="view diff"
                aria-label="view pr diff"
                className={cn('shrink-0', ICON_BTN)}
              >
                <FileEdit size={11} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={11} className="shrink-0 animate-spin" aria-hidden />
            <button
              type="button"
              onClick={copyBranch}
              className={cn(
                'min-w-0 flex-1 truncate text-left font-mono focus:outline-none',
                copied ? 'text-success' : 'hover:text-foreground',
              )}
              title={copied ? 'copied!' : `copy branch: ${branch}`}
              aria-label={`copy branch name ${branch}`}
            >
              {branch}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <GitBranch size={11} aria-hidden className="shrink-0 text-muted-foreground" />
            <button
              type="button"
              onClick={copyBranch}
              className={cn(
                'min-w-0 flex-1 truncate text-left font-mono text-xs transition-colors focus:outline-none',
                copied
                  ? 'text-success'
                  : 'text-foreground hover:text-muted-foreground focus:text-muted-foreground',
              )}
              title={copied ? 'copied!' : `copy branch: ${branch}`}
              aria-label={`copy branch name ${branch}`}
            >
              {branch}
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleCreatePr()}
              disabled={loading}
              className="h-5 shrink-0 gap-0.5 px-1.5 text-[10px]"
            >
              <Plus size={10} aria-hidden />
              Open PR
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

        {pr ? (
          <div className="border-t border-border-soft pt-1.5">
            <GithubCard
              pr={pr}
              detail={ghState?.detail ?? null}
              detailLoading={ghState?.detailLoading ?? false}
              detailError={ghState?.detailError ?? null}
              detailFetchedAt={ghState?.detailFetchedAt ?? null}
              branchLastActivity={session.updatedAt}
              onOpenUrl={openInBrowser}
              onRefresh={() => void refreshSessionPrDetail(session.id, { force: true })}
              onSpawnFromComment={(c: PrComment) => {
                const args = buildCommentAgentArgs(c, pr);
                void spawnAgent(session.id, args);
              }}
              onSpawnFromReviewChanges={() => {
                const open = (ghState?.detail?.comments ?? []).filter(
                  (c) => c.source !== 'review' || c.resolved === false,
                );
                if (open.length === 0) return;
                const args = buildReviewChangesAgentArgs(pr, open);
                void spawnAgent(session.id, args);
              }}
            />
          </div>
        ) : null}
      </div>

      {repoSlug && pr ? (
        <DiffViewerDialog
          open={diffOpen}
          onClose={() => setDiffOpen(false)}
          sessionId={session.id}
          repoSlug={repoSlug}
          prNumber={pr.number}
          cwd={workspace?.rootPath}
          workingDir={workspace?.rootPath}
        />
      ) : null}
    </section>
  );
}

interface SlotMeta {
  readonly icon: LucideIcon;
  readonly iconClass: string;
  readonly emphasis?: boolean;
  readonly tintedWhenNonEmpty?: string;
  readonly emptyLabel: string;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly singleLine?: boolean;
}

const MARKDOWN_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>([
  'open_questions',
  'decisions',
  'last_output_summary',
]);

const SLOT_META: Record<Exclude<SlotKey, 'files_touched'>, SlotMeta> = {
  goal: {
    icon: Target,
    iconClass: 'text-primary',
    emphasis: true,
    singleLine: true,
    emptyLabel: 'no goal set',
  },
  decisions: {
    icon: CheckCheck,
    iconClass: 'text-success',
    collapsible: true,
    defaultCollapsed: true,
    emptyLabel: 'no decisions yet',
  },
  open_questions: {
    icon: HelpCircle,
    iconClass: 'text-warning',
    tintedWhenNonEmpty: 'border-l-2 border-warning bg-warning/5',
    emptyLabel: 'no open questions',
  },
  last_output_summary: {
    icon: Activity,
    iconClass: 'text-info',
    collapsible: true,
    defaultCollapsed: true,
    emptyLabel: 'no output yet',
  },
};

function countMarkdownItems(value: string): number {
  return value.split('\n').filter((l) => /^\s*([-*+]|\d+\.)\s+/.test(l)).length;
}

function firstMeaningfulLine(value: string): string {
  for (const raw of value.split('\n')) {
    const t = raw
      .trim()
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^#+\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '');
    if (t) return t;
  }
  return '';
}

function normalizeFilesSlot(slot: ContextSlot, workingDir: string | null): ContextSlot {
  if (!workingDir || slot.value.length === 0) return slot;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  const normalized = slot.value
    .split('\n')
    .map((p) => (p.startsWith(root) ? p.slice(root.length) : p))
    .join('\n');
  return normalized === slot.value ? slot : { ...slot, value: normalized };
}

interface SlotRowProps {
  sessionId: SessionId;
  slotKey: SlotKey;
  slot: ContextSlot | undefined;
  loading?: boolean;
  isSummarizing?: boolean;
  onCommit: (value: string) => void;
}

function SlotRow({
  sessionId,
  slotKey,
  slot,
  loading = false,
  isSummarizing = false,
  onCommit,
}: SlotRowProps) {
  const value = slot?.value ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const history = useSlotHistory(sessionId, slotKey);

  // Per-slot skeleton: while the slots fetch is still in flight and this
  // particular slot hasn't materialized yet, show a placeholder. Sibling
  // slots that already arrived render their content independently. Placed
  // after all hook calls so the hook count stays stable across renders.
  if (slot === undefined && loading) return <SlotRowSkeleton slotKey={slotKey} />;

  const meta = slotKey === 'files_touched' ? null : SLOT_META[slotKey];
  const Icon = meta?.icon;
  const hasValue = value.length > 0;
  const renderAsMarkdown = MARKDOWN_SLOTS.has(slotKey);
  const collapsible = meta?.collapsible ?? false;
  const singleLine = meta?.singleLine ?? false;
  const [collapsed, setCollapsed] = useState(meta?.defaultCollapsed ?? false);
  const itemCount = collapsible && hasValue ? countMarkdownItems(value) : 0;
  const preview = collapsible && hasValue ? firstMeaningfulLine(value) : '';
  const CollapseIcon = collapsed ? ChevronRight : ChevronDown;

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const openHistory = useCallback(() => {
    void loadSlotHistory(sessionId, slotKey);
    setHistoryOpen(true);
  }, [loadSlotHistory, sessionId, slotKey]);

  const restore = useCallback(
    (entry: ContextSlotHistoryEntry) => {
      onCommit(entry.value);
      setHistoryOpen(false);
    },
    [onCommit],
  );

  const headerLabel = collapsible ? (
    <button
      type="button"
      onClick={() => setCollapsed((v) => !v)}
      className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      title={collapsed ? 'expand' : 'collapse'}
      aria-expanded={!collapsed}
    >
      <CollapseIcon size={11} aria-hidden className="shrink-0" />
      {Icon ? <Icon size={11} aria-hidden className={meta?.iconClass} /> : null}
      <span>{SLOT_LABELS[slotKey]}</span>
      {hasValue && collapsed ? (
        <span className="ml-1 normal-case tracking-normal text-2xs text-muted-foreground/70">
          {itemCount > 0 ? `· ${itemCount} item${itemCount === 1 ? '' : 's'}` : '· …'}
        </span>
      ) : null}
    </button>
  ) : (
    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {Icon ? <Icon size={11} aria-hidden className={meta?.iconClass} /> : null}
      {SLOT_LABELS[slotKey]}
    </label>
  );

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        {headerLabel}
        <button
          type="button"
          onClick={openHistory}
          title="view history"
          aria-label={`view history for ${SLOT_LABELS[slotKey]}`}
          className={cn(ICON_BTN, 'shrink-0')}
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
          className="font-mono text-xs"
          autoGrow
          maxRows={16}
        />
      ) : isSummarizing ? (
        <SlotSkeleton emphasis={meta?.emphasis} />
      ) : !hasValue ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left text-xs italic text-muted-foreground/60 hover:text-foreground"
        >
          {meta?.emptyLabel ?? 'empty — click to edit'}
        </button>
      ) : singleLine ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={value}
          className={cn(
            'truncate rounded-md border border-transparent bg-subtle px-2.5 py-1.5 text-left text-sm font-medium hover:border-border-soft hover:bg-muted/40',
            meta?.tintedWhenNonEmpty,
          )}
        >
          {value}
        </button>
      ) : collapsible && collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="expand"
          className={cn(
            'flex w-full items-center gap-1.5 truncate rounded-md border border-transparent bg-subtle px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:border-border-soft hover:bg-muted/40 hover:text-foreground',
          )}
        >
          <span className="truncate">{preview}</span>
        </button>
      ) : renderAsMarkdown ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'cursor-text rounded-md border border-transparent px-2.5 py-2 text-left leading-relaxed hover:border-border-soft hover:bg-muted/40 focus-visible:outline-none focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/15',
            'bg-subtle',
            meta?.tintedWhenNonEmpty,
          )}
        >
          <Markdown text={value} className="text-[13px] text-foreground" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'whitespace-pre-wrap break-words rounded-md border border-transparent px-2.5 py-2 text-left leading-relaxed hover:border-border-soft hover:bg-muted/40',
            meta?.emphasis ? 'bg-subtle text-sm font-medium' : 'bg-subtle text-xs',
            meta?.tintedWhenNonEmpty,
          )}
        >
          {value}
        </button>
      )}

      <SlotHistoryDialog
        label={SLOT_LABELS[slotKey]}
        renderAsMarkdown={renderAsMarkdown}
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
  renderAsMarkdown: boolean;
  open: boolean;
  entries: ReadonlyArray<ContextSlotHistoryEntry>;
  onRestore: (entry: ContextSlotHistoryEntry) => void;
  onClose: () => void;
}

function SlotHistoryDialog({
  label,
  renderAsMarkdown,
  open,
  entries,
  onRestore,
  onClose,
}: SlotHistoryDialogProps) {
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
              {renderAsMarkdown ? (
                <div className="max-h-40 overflow-hidden text-xs leading-relaxed text-foreground">
                  <Markdown text={entry.value} className="text-xs" />
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground line-clamp-4">
                  {entry.value}
                </p>
              )}
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
  const tooltip = (() => {
    if (status === 'error' && error) return `last error: ${error}`;
    if (lastUpdate) return `last update: ${lastUpdate}`;
    return 'summarizer running — input is not blocked';
  })();
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

const PLAN_STATUS_STYLE: Record<PlanStatus, string> = {
  active: 'bg-warning/10 text-warning',
  consumed: 'bg-info/10 text-info',
  superseded: 'bg-muted text-muted-foreground',
};

function PlansSection({ sessionId }: { sessionId: SessionId }) {
  const plans = useSessionPlans(sessionId);
  const loading = useSessionLoading(sessionId);
  const loadSessionPlans = useAppStore((s) => s.loadSessionPlans);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void loadSessionPlans(sessionId);
  }, [sessionId, loadSessionPlans]);

  if (plans.length === 0 && loading.plans) return <PlansSkeleton />;
  if (plans.length === 0) return null;

  const latest = plans[plans.length - 1];
  if (!latest) return null;
  const latestIndex = plans.length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ClipboardList size={11} aria-hidden className="text-primary" />
          plans
        </span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title={`view all plans (${plans.length})`}
          aria-label={`view all plans (${plans.length})`}
          className={cn(ICON_BTN, 'inline-flex items-center gap-1 text-2xs')}
        >
          <span>{plans.length}</span>
          <List size={11} aria-hidden />
        </button>
      </div>
      <LatestPlanCard plan={latest} index={latestIndex} />
      <PlansModal
        sessionId={sessionId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPlanId={latest.id}
      />
    </section>
  );
}

interface LatestPlanCardProps {
  readonly plan: PlanWithCount;
  readonly index: number;
}

function LatestPlanCard({ plan, index }: LatestPlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          title={expanded ? 'collapse plan' : 'expand plan'}
        >
          <Chevron size={11} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
            plan {index}
          </span>
          <span className="truncate text-xs font-medium text-foreground">{plan.title}</span>
        </button>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
            PLAN_STATUS_STYLE[plan.status],
          )}
        >
          {plan.status}
        </span>
      </div>
      {expanded ? <Markdown text={plan.bodyMd} className="text-xs" /> : null}
    </div>
  );
}
