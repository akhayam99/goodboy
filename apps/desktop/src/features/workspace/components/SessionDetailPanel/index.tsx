import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronRight,
  Clock,
  FileEdit,
  GitBranch,
  GitPullRequest,
  GitPullRequestArrow,
  Loader2,
  MessageSquare,
  RefreshCw,
  Settings2,
  XCircle,
} from 'lucide-react';
import { cn } from '@goodboy/ui';
import { PullRequestChip } from '../../../../features/github/components/PullRequestChip';
import type {
  PullRequestStateKind,
  Session,
  SessionId,
  TelemetryRecord,
  WorktreeStatus,
} from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useDiffComments,
  useFilesTouched,
  useSessionLoading,
  useSummarizerStatus,
} from '../../../../store';
import { SessionStatusMenu } from '../../../session/components/SessionStatusMenu';
import { OpenInEditorIconButton } from '../../../session/components/OpenInEditorIconButton';
import { RunScriptControl } from '../../../scripts';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
import { DiffViewerDialog } from '../../../permissions/components/DiffViewerDialog';
import { PricingDialog } from '../../../providers/components/PricingDialog';
import { worktreeStatus } from '../../../worktree/worktree';

interface SessionDetailPanelProps {
  session: Session;
  onOpenSessionSettings: () => void;
}

export function SessionDetailPanel({ session, onOpenSessionSettings }: SessionDetailPanelProps) {
  const worktreePath = useAppStore((s) => s.sessionWorktrees[session.id as SessionId]?.[0] ?? null);
  const setSessionUserStatus = useAppStore((s) => s.setSessionUserStatus);
  const renameTask = useAppStore((s) => s.renameTask);

  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const startRename = () => {
    setRenameDraft(session.goal);
    setRenameError(null);
    setRenaming(true);
  };

  const commitRename = async () => {
    if (!renameDraft.trim()) {
      setRenameError('name cannot be empty');
      return;
    }
    try {
      await renameTask(session.id as SessionId, renameDraft.trim());
      setRenaming(false);
      setRenameError(null);
    } catch (err) {
      setRenameError(formatError(err));
    }
  };

  const onRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void commitRename();
    if (e.key === 'Escape') {
      setRenaming(false);
      setRenameError(null);
    }
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-2">
      {/* header row — user tick · title · settings */}
      <div className="flex items-center gap-2">
        <SessionStatusMenu
          status={session.userStatus}
          sessionLabel={session.goal}
          onPick={(next) => void setSessionUserStatus(session.id as SessionId, next)}
        />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex flex-col gap-0.5">
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={onRenameKeyDown}
                className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary"
              />
              {renameError && <span className="text-2xs text-danger">{renameError}</span>}
            </div>
          ) : (
            <span
              className="line-clamp-2 cursor-pointer text-xs font-semibold leading-snug text-foreground"
              onDoubleClick={startRename}
              title="double-click to rename"
            >
              {session.goal}
            </span>
          )}
        </div>
        <OpenInEditorIconButton worktreePath={worktreePath} />
        <RunScriptControl workspaceId={session.workspaceId} />
        <button
          type="button"
          onClick={onOpenSessionSettings}
          className="shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
          title="session settings"
          aria-label="session settings"
        >
          <Settings2 size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function BranchChip({ branch }: { branch: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(branch);
      setCopied(true);
      showToast('success', 'branch copied');
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      showToast('error', `copy failed: ${formatError(err)}`);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      title="click to copy branch name"
      className={cn(
        'group inline-flex min-w-0 max-w-full shrink items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-2xs transition-colors',
        copied
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-border-soft bg-muted/30 text-foreground/80 hover:border-border hover:bg-muted/50 hover:text-foreground',
      )}
    >
      {copied ? (
        <Check size={10} aria-hidden className="shrink-0" />
      ) : (
        <GitBranch
          size={10}
          aria-hidden
          className="shrink-0 text-muted-foreground group-hover:text-foreground"
        />
      )}
      <span className="truncate">{branch}</span>
    </button>
  );
}

function SessionCostChip({ sessionId }: { sessionId: SessionId }) {
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const [pricingOpen, setPricingOpen] = useState(false);
  const sessionCost = useMemo(() => {
    let sum = 0;
    for (const rec of telemetry) {
      if (rec.kind === 'summarizer') continue;
      sum += rec.estimatedCostUsd;
    }
    return sum;
  }, [telemetry]);
  const finalLabel = sessionCost === 0 ? '$0' : `$${sessionCost.toFixed(2)}`;

  const [displayLabel, setDisplayLabel] = useState(finalLabel);
  const [animating, setAnimating] = useState(false);
  const prevCostRef = useRef(sessionCost);
  const prevSessionIdRef = useRef(sessionId);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Session switch — snap, don't animate stale → fresh transition.
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      prevCostRef.current = sessionCost;
      setDisplayLabel(finalLabel);
      setAnimating(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    if (prevCostRef.current === sessionCost) {
      setDisplayLabel(finalLabel);
      return;
    }
    const fromCost = prevCostRef.current;
    const toCost = sessionCost;
    prevCostRef.current = toCost;

    // Respect reduced motion: snap to final, no roll, no glow.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayLabel(finalLabel);
      setAnimating(false);
      return;
    }

    // Interpolate the numeric value directly and re-format on every frame.
    // The previous slot-machine roller spun each digit through extra full
    // 0-9 cycles, so a small bump like $0.99 → $1.05 briefly painted
    // $9.XX mid-animation. Value-space interpolation can never show a
    // number outside [fromCost, toCost], so the chip reads as a real
    // counter regardless of direction.
    setAnimating(true);
    const duration = 1100;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromCost + (toCost - fromCost) * eased;
      setDisplayLabel(current === 0 ? '$0' : `$${current.toFixed(2)}`);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setDisplayLabel(finalLabel);
        setAnimating(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [sessionCost, sessionId, finalLabel]);

  return (
    <>
      <button
        type="button"
        onClick={() => setPricingOpen(true)}
        title={`Estimated cost for this session: ${finalLabel} (excluding summarizer) — click for spend breakdown`}
        className={cn(
          'inline-flex shrink-0 items-center rounded-md border border-success/20 bg-success/10 px-2 py-1 font-mono text-2xs text-success transition-colors hover:border-success/40 hover:bg-success/15',
          animating && 'cost-chip-pulse',
        )}
      >
        {displayLabel}
      </button>
      <PricingDialog open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </>
  );
}

function GithubRefreshButton({ sessionId }: { sessionId: SessionId }) {
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const loading = useAppStore((s) => s.sessionGithub[sessionId]?.loading ?? false);
  const detailLoading = useAppStore((s) => s.sessionGithub[sessionId]?.detailLoading ?? false);
  const spinning = loading || detailLoading;

  const onRefresh = (e: React.MouseEvent) => {
    // Stop propagation so clicking refresh doesn't also fire the parent
    // GithubCard 'open details' handler.
    e.stopPropagation();
    void refreshSessionPr(sessionId, { force: true }).then(() =>
      refreshSessionPrDetail(sessionId, { force: true }),
    );
  };

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={spinning}
      title="refresh github status"
      aria-label="refresh github status"
      className="shrink-0 rounded p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      <RefreshCw size={10} aria-hidden className={cn('shrink-0', spinning && 'animate-spin')} />
    </button>
  );
}

interface GithubCardProps {
  sessionId: SessionId;
  pr: { number: number; state: PullRequestStateKind; url: string } | null;
  loading: boolean;
  detail: import('@goodboy/types').PrDetail | null;
  onOpenDetails?: () => void;
}

function GithubCard({ sessionId, pr, loading, detail, onOpenDetails }: GithubCardProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border-soft bg-muted/30 px-2.5 py-1.5 text-2xs text-muted-foreground">
        <Loader2 size={11} aria-hidden className="animate-spin" />
        <span>loading github…</span>
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border-soft bg-muted/30 px-2.5 py-1.5 text-2xs">
        <GitPullRequest size={12} aria-hidden className="shrink-0 text-muted-foreground/60" />
        <span className="text-muted-foreground">no PR yet</span>
        <span className="ml-auto" />
        <GithubRefreshButton sessionId={sessionId} />
      </div>
    );
  }

  const unresolvedComments = (detail?.comments ?? []).filter(
    (c) => c.source !== 'review' || c.resolved === false,
  ).length;
  const ciState = computeCiState(detail?.checks ?? []);

  return (
    <button
      type="button"
      onClick={onOpenDetails}
      disabled={!onOpenDetails}
      className="group flex items-center gap-2 rounded-md border border-border-soft bg-muted/30 px-2.5 py-1.5 text-left text-foreground/80 transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-default disabled:hover:border-border-soft disabled:hover:bg-muted/30"
    >
      <PullRequestChip state={pr.state} variant="badge" number={pr.number} iconSize={11} />
      <span className="text-2xs text-muted-foreground/40">·</span>
      <CiBadge state={ciState} />
      <span className="text-2xs text-muted-foreground/40">·</span>
      <span className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground">
        <MessageSquare size={10} aria-hidden />
        <span className="tabular-nums">{unresolvedComments}</span>
      </span>
      <span className="ml-auto flex items-center gap-1">
        <GithubRefreshButton sessionId={sessionId} />
        <span className="inline-flex items-center gap-0.5 text-2xs text-muted-foreground/60 transition-colors group-hover:text-foreground">
          <span>details</span>
          <ChevronRight size={11} aria-hidden />
        </span>
      </span>
    </button>
  );
}

type CiState = 'success' | 'failure' | 'pending' | 'none';

function computeCiState(checks: ReadonlyArray<import('@goodboy/types').PrCheckRun>): CiState {
  if (checks.length === 0) return 'none';
  if (
    checks.some(
      (c) =>
        c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out',
    )
  ) {
    return 'failure';
  }
  if (checks.some((c) => c.conclusion === 'pending')) return 'pending';
  if (checks.some((c) => c.conclusion === 'success')) return 'success';
  return 'none';
}

interface SessionMetaFooterProps {
  session: Session;
  onOpenGithubDetails?: () => void;
}

export function SessionMetaFooter({ session, onOpenGithubDetails }: SessionMetaFooterProps) {
  const loading = useSessionLoading(session.id);
  const summarizer = useSummarizerStatus(session.id);
  const workingDir = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const branch = useAppStore((s) => s.sessionBranches[session.id as SessionId] ?? null);
  const github = useAppStore((s) => s.sessionGithub[session.id as SessionId]);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const pr = github?.pr ?? null;
  // Branch needed to even kick off a fetch — fall through to "no PR yet"
  // instead of pinning the card to "loading…".
  const prLoading = branch
    ? !github || github.loading || (github.fetchedAt === null && !github.error)
    : false;

  // Kick off a GitHub PR fetch the first time we render this session with a
  // resolved branch. The sidebar-wide warmup runs once on app mount and can
  // miss sessions whose branch loads later, leaving the card stuck.
  useEffect(() => {
    if (!branch) return;
    if (github && github.fetchedAt !== null) return;
    if (github?.loading) return;
    void refreshSessionPr(session.id as SessionId);
  }, [session.id, branch, github, refreshSessionPr]);
  const filesTouched = useFilesTouched(session.id);
  const diffComments = useDiffComments(session.id);
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);
  const [gitStatus, setGitStatus] = useState<WorktreeStatus | null>(null);
  const [filesDiffOpen, setFilesDiffOpen] = useState(false);
  const [filesDiffJumpToNotes, setFilesDiffJumpToNotes] = useState(false);

  useEffect(() => {
    void loadDiffComments(session.id);
  }, [session.id, loadDiffComments]);

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

  // Prefer the branch-vs-base count: stable across pushes (it counts every
  // file that differs from main, not just current working-tree dirt).
  // Fall back to working-tree status only if the branch diff is unavailable.
  const filesTouchedCount = filesTouched.count > 0 ? filesTouched.count : (gitStatus?.changed ?? 0);
  const openNotesCount = useMemo(
    () => diffComments.filter((c) => c.status === 'open').length,
    [diffComments],
  );

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

  const isFilesLoading = filesTouchedCount === 0 && (loading.transcript || loading.agents);

  const filesButton = isFilesLoading ? (
    <div
      role="status"
      aria-label="loading files touched"
      className="flex items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-1.5"
    >
      <div className="h-2.5 w-2.5 animate-pulse rounded-sm bg-muted" />
      <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
    </div>
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
            ? 'border border-border-soft text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
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
      <span className="inline-flex shrink-0 items-center gap-1.5">
        {filesTouched.additions > 0 || filesTouched.deletions > 0 ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular-nums">
            {filesTouched.additions > 0 ? (
              <span className="text-success">+{filesTouched.additions}</span>
            ) : null}
            {filesTouched.deletions > 0 ? (
              <span className="text-danger">−{filesTouched.deletions}</span>
            ) : null}
          </span>
        ) : null}
        <span aria-hidden className="opacity-60">
          ↗
        </span>
      </span>
    </button>
  );

  return (
    <>
      <div className="flex shrink-0 flex-col gap-1.5 px-3 pb-3 pt-2">
        {branch ? <BranchChip branch={branch} /> : null}
        <div className="flex items-center gap-2">
          <SessionCostChip sessionId={session.id as SessionId} />
          <div className="min-w-0 flex-1">{filesButton}</div>
        </div>
        <GithubCard
          sessionId={session.id as SessionId}
          pr={pr}
          loading={prLoading}
          detail={github?.detail ?? null}
          onOpenDetails={onOpenGithubDetails}
        />
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

function CiBadge({ state }: { state: CiState }) {
  const map: Record<CiState, { icon: React.ElementType; className: string; label: string }> = {
    success: { icon: GitPullRequestArrow, className: 'text-success', label: 'ci ✓' },
    failure: { icon: XCircle, className: 'text-danger', label: 'ci ✗' },
    pending: { icon: Clock, className: 'text-warning', label: 'ci …' },
    none: { icon: Clock, className: 'text-muted-foreground/40', label: 'no ci' },
  };
  const entry = map[state];
  const Icon = entry.icon;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-2xs', entry.className)}>
      <Icon size={10} aria-hidden />
      <span className="font-medium">{entry.label}</span>
    </span>
  );
}
