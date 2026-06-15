import {
  ArrowUpRight,
  Clock,
  GitPullRequest,
  GitPullRequestArrow,
  MessageSquare,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { PrCheckRun, SessionId } from '@goodboy/types';
import { PullRequestChip } from '../../../../github/components/PullRequestChip';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { useAppStore } from '../../../../../store';

export function GithubStrip({ sessionId }: { sessionId: SessionId }) {
  const workspaceId = useAppStore(
    (s) => s.sessions.find((x) => x.id === sessionId)?.workspaceId ?? null,
  );
  const remoteKind = useRemoteHostKind(workspaceId);
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const pr = github?.pr ?? null;
  const loading = github?.loading ?? false;
  const error = github?.error ?? null;
  const openStudio = () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-github-session', { detail: { sessionId } }));

  const detail = github?.detail ?? null;
  const unresolvedComments = (detail?.comments ?? []).filter(
    (c) => c.source !== 'review' || c.resolved === false,
  ).length;
  const ciState = computeCiState(detail?.checks ?? []);

  if (remoteKind === 'gitlab') {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={openStudio}
          title="open in github studio"
          className={cn(
            'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ring-1 transition-colors hover:bg-foreground/5',
            pr
              ? 'ring-border-soft'
              : 'text-muted-foreground/70 ring-border-soft/40 hover:text-foreground',
          )}
        >
          {pr ? (
            <span className="inline-flex min-w-0 items-center gap-2">
              <PullRequestChip state={pr.state} variant="badge" number={pr.number} iconSize={11} />
              {ciState !== 'none' ? <CiBadge state={ciState} /> : null}
              {unresolvedComments > 0 ? (
                <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                  <MessageSquare size={11} aria-hidden />
                  <span className="tabular-nums">{unresolvedComments}</span>
                </span>
              ) : null}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <GitPullRequest size={12} aria-hidden />
              <span>No PR yet</span>
            </span>
          )}
          <ArrowUpRight size={12} aria-hidden className="shrink-0 opacity-70" />
        </button>
        <button
          type="button"
          onClick={() => void refreshSessionPr(sessionId, { force: true })}
          disabled={loading}
          title={error ? `refresh failed: ${error}` : 'refresh PR status'}
          aria-label="refresh PR status"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground ring-1 ring-border-soft/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={12} aria-hidden className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>
      {error ? (
        <span className="px-1 text-2xs text-danger" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

type CiState = 'success' | 'failure' | 'pending' | 'none';

function computeCiState(checks: ReadonlyArray<PrCheckRun>): CiState {
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

function CiBadge({ state }: { state: CiState }) {
  const map: Record<CiState, { icon: LucideIcon; className: string; label: string }> = {
    success: { icon: GitPullRequestArrow, className: 'text-success', label: 'ci ✓' },
    failure: { icon: XCircle, className: 'text-danger', label: 'ci ✗' },
    pending: { icon: Clock, className: 'text-warning', label: 'ci …' },
    none: { icon: Clock, className: 'text-muted-foreground/40', label: 'no ci' },
  };
  const entry = map[state];
  const Icon = entry.icon;
  return (
    <span className={cn('inline-flex items-center gap-0.5', entry.className)}>
      <Icon size={11} aria-hidden />
      <span className="font-medium">{entry.label}</span>
    </span>
  );
}
