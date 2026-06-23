import { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  RefreshCw,
  Sparkles,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { PrCheckRun, Session, SessionId } from '@goodboy/types';
import { PullRequestChip } from '../../../../github/components/PullRequestChip';
import { GitlabMrStrip } from '../../../../context/components/ContextPanel/strips/GitlabMrStrip';
import { PendingResolutionsStrip } from '../../../../context/components/ContextPanel/strips/PendingResolutionsStrip';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { AGENT_KIND_DEFAULTS } from '../../../agent-kind';
import { useAppStore } from '../../../../../store';
import { PaneShell } from './PaneShell';

type PrPaneProps = {
  readonly session: Session;
};

export const PrPane = ({ session }: PrPaneProps) => {
  const sessionId = session.id as SessionId;
  const remoteKind = useRemoteHostKind(session.workspaceId);
  return (
    <PaneShell
      title="Pull request"
      description="Review status and queued comment resolutions for this session."
    >
      <div className="flex flex-col gap-3">
        {remoteKind === 'gitlab' ? (
          <GitlabMrStrip sessionId={sessionId} />
        ) : (
          <GithubPrCard session={session} />
        )}
        <PendingResolutionsStrip sessionId={sessionId} />
      </div>
    </PaneShell>
  );
};

const GithubPrCard = ({ session }: { session: Session }) => {
  const sessionId = session.id as SessionId;
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const createPrForSession = useAppStore((s) => s.createPrForSession);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const pr = github?.pr ?? null;
  const detail = github?.detail ?? null;
  const loading = github?.loading ?? false;
  const error = github?.error ?? null;

  const [busy, setBusy] = useState<'draft' | 'ai' | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const openStudio = () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-github-session', { detail: { sessionId } }));
  const refresh = () => void refreshSessionPr(sessionId, { force: true });

  const createQuickDraft = async () => {
    if (busy) return;
    setBusy('draft');
    setCreateError(null);
    try {
      await createPrForSession(sessionId, { draft: true });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const draftWithAgent = async () => {
    if (busy) return;
    setBusy('ai');
    setCreateError(null);
    try {
      const prompt = [
        `Open a draft GitHub pull request for this session's branch.`,
        `- Write a clear, conventional title and a concise, well-structured description from the committed changes.`,
        `- Session goal: "${session.goal}".`,
        `- If this project defines a PR-creation skill, command, or template (look under .claude/), follow it.`,
        `Then run \`gh pr create --draft\` to open it and report the PR URL.`,
      ].join('\n');
      const agentId = await spawnAgent(sessionId, {
        name: 'open pull request',
        initialPrompt: prompt,
        model: AGENT_KIND_DEFAULTS.generic.model,
        effort: AGENT_KIND_DEFAULTS.generic.effort,
      });
      setActiveLens(sessionId, 'agents');
      await selectAgent(sessionId, agentId);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };

  if (!pr) {
    return (
      <div className="animate-fade-in relative flex flex-col items-center gap-5 rounded-lg border border-border-soft bg-elevated px-8 py-8 text-center">
        <div className="absolute right-3 top-3">
          <RefreshButton onClick={refresh} loading={loading} error={error} />
        </div>
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/15"
        >
          <GitPullRequest size={26} className="text-primary" />
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <h2 className="text-base font-semibold text-foreground">Open a pull request</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Turn this session&rsquo;s work into a draft PR. Let an agent write the title and
            description from your commits, or open one instantly.
          </p>
          {branch ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 font-mono text-2xs text-muted-foreground ring-1 ring-border-soft/60">
              <GitBranch size={11} aria-hidden className="shrink-0" />
              <span className="truncate text-foreground/80">{branch}</span>
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 pt-1 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void draftWithAgent()}
            disabled={busy !== null}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50',
              busy === 'ai' && 'animate-border-pulse',
            )}
          >
            <Sparkles size={14} aria-hidden className="shrink-0" />
            Draft with an agent
          </button>
          <button
            type="button"
            onClick={() => void createQuickDraft()}
            disabled={busy !== null}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08] disabled:opacity-50',
              busy === 'draft' && 'animate-border-pulse',
            )}
          >
            <GitPullRequest size={14} aria-hidden className="shrink-0 opacity-70" />
            Quick draft
          </button>
          <button
            type="button"
            onClick={openStudio}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Customize
            <ArrowUpRight size={13} aria-hidden className="shrink-0 opacity-70" />
          </button>
        </div>
        {createError ? (
          <span className="text-2xs text-danger" title={createError}>
            {createError}
          </span>
        ) : null}
      </div>
    );
  }

  const ciState = computeCiState(detail?.checks ?? []);
  const unresolved = (detail?.comments ?? []).filter(
    (c) => c.source !== 'review' || c.resolved === false,
  ).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-elevated px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <PullRequestChip state={pr.state} variant="badge" number={pr.number} iconSize={12} />
            {ciState !== 'none' ? <CiBadge state={ciState} /> : null}
          </div>
          <h2 className="text-balance text-sm font-semibold leading-snug text-foreground">
            {pr.title}
          </h2>
        </div>
        <RefreshButton onClick={refresh} loading={loading} error={error} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <GitBranch size={11} aria-hidden className="shrink-0" />
          <span className="truncate font-medium text-foreground/80">{pr.headBranch}</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="truncate">{pr.baseBranch}</span>
        </span>
        {pr.reviewDecision ? <ReviewBadge decision={pr.reviewDecision} /> : null}
        {unresolved > 0 ? (
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={11} aria-hidden />
            <span className="tabular-nums">{unresolved}</span>
            <span>unresolved</span>
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={openStudio}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08]"
      >
        Open in GitHub studio
        <ArrowUpRight size={13} aria-hidden className="shrink-0 opacity-70" />
      </button>

      {error ? (
        <span className="text-2xs text-danger" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
};

const RefreshButton = ({
  onClick,
  loading,
  error,
}: {
  onClick: () => void;
  loading: boolean;
  error: string | null;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    title={error ? `refresh failed: ${error}` : 'refresh PR status'}
    aria-label="refresh PR status"
    className={cn(
      'flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground ring-1 ring-border-soft/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50',
      loading && 'animate-border-pulse',
    )}
  >
    <RefreshCw size={12} aria-hidden />
  </button>
);

type CiState = 'success' | 'failure' | 'pending' | 'none';

const computeCiState = (checks: ReadonlyArray<PrCheckRun>): CiState => {
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
};

const CiBadge = ({ state }: { state: CiState }) => {
  const map: Record<CiState, { icon: LucideIcon; className: string; label: string }> = {
    success: { icon: CheckCircle2, className: 'text-success', label: 'CI passing' },
    failure: { icon: XCircle, className: 'text-danger', label: 'CI failing' },
    pending: { icon: Clock, className: 'text-warning', label: 'CI running' },
    none: { icon: Clock, className: 'text-muted-foreground/40', label: 'no CI' },
  };
  const entry = map[state];
  const Icon = entry.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-2xs font-medium', entry.className)}>
      <Icon size={12} aria-hidden />
      {entry.label}
    </span>
  );
};

const ReviewBadge = ({
  decision,
}: {
  decision: 'approved' | 'changes_requested' | 'review_required';
}) => {
  const map = {
    approved: { className: 'text-success', label: 'Approved' },
    changes_requested: { className: 'text-warning', label: 'Changes requested' },
    review_required: { className: 'text-muted-foreground', label: 'Review required' },
  } as const;
  const entry = map[decision];
  return <span className={cn('font-medium', entry.className)}>{entry.label}</span>;
};
