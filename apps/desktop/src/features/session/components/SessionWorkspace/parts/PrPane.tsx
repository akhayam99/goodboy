import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  GitBranch,
  GitFork,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Button, Eyebrow, cn } from '@goodboy/ui';
import type {
  LinkedIssue,
  PrCheckRun,
  PullRequestStateKind,
  Session,
  SessionExternalTask,
  SessionId,
} from '@goodboy/types';
import { PullRequestChip, pullRequestMeta } from '../../../../github/components/PullRequestChip';
import { PrSwitcher } from '../../../../github/components/GitHubStudio/PrSwitcher';
import { ExternalTaskChip } from '../../../../integrations/components/ExternalTaskChip';
import { GitlabMrStrip } from '../../../../context/components/ContextPanel/strips/GitlabMrStrip';
import { MissingGithubRemoteEmptyState } from '../../../../github/components/MissingGithubRemoteEmptyState';
import { resolveIntegrationConnection } from '../../../../integrations/connection';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { RefreshIconButton } from '../../../../../shared/components/RefreshIconButton';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { isPrReviewSession } from '../../../../../store/slices/session-view';
import { PaneShell } from './PaneShell';
import { PrListRow } from './PrListRow';

type Props = {
  readonly session: Session;
};

type PullRequestProvider = 'github' | 'gitlab';

export const PrPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const remoteKind = useRemoteHostKind(session.workspaceId);
  const canonicalPullRequest = useAppStore((state) => state.sessionGithub[sessionId]?.pr ?? null);
  const branchPrs = useAppStore((state) => state.sessionGithubPrs[sessionId] ?? EMPTY_ARRAY);
  const selectedPrNumber = useAppStore((state) => state.sessionSelectedPrNumber[sessionId] ?? null);
  const selectedPullRequest =
    selectedPrNumber != null
      ? (branchPrs.find((candidate) => candidate.number === selectedPrNumber) ?? null)
      : null;
  const pullRequest = selectedPullRequest ?? canonicalPullRequest;
  const mergeRequest = useAppStore((state) => state.sessionGitlabMr[sessionId]?.mr ?? null);
  const phaseRuns = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const isPrReview = useMemo(() => isPrReviewSession({ agents: phaseRuns }), [phaseRuns]);
  const [selectedProvider, setSelectedProvider] = useState<PullRequestProvider | null>(null);
  const defaultProvider: PullRequestProvider =
    remoteKind === 'gitlab' && mergeRequest != null
      ? 'gitlab'
      : pullRequest != null
        ? 'github'
        : mergeRequest != null
          ? 'gitlab'
          : remoteKind === 'gitlab'
            ? 'gitlab'
            : 'github';
  const activeProvider =
    selectedProvider === 'github' && pullRequest != null
      ? 'github'
      : selectedProvider === 'gitlab' && mergeRequest != null
        ? 'gitlab'
        : defaultProvider;
  const mergeRequestState: PullRequestStateKind | null =
    mergeRequest == null
      ? null
      : mergeRequest.draft
        ? 'draft'
        : mergeRequest.state === 'merged'
          ? 'merged'
          : mergeRequest.state === 'closed'
            ? 'closed'
            : 'open';
  const hasBothProviders = pullRequest != null && mergeRequest != null;

  const description =
    activeProvider === 'gitlab'
      ? 'Merge request and linked issues for this session.'
      : 'Pull request and linked issues for this session.';

  return (
    <PaneShell title="Pull requests" description={description}>
      <div className="flex flex-col gap-3">
        {hasBothProviders ? (
          <div className="flex flex-col gap-1.5">
            <Eyebrow label="Pull requests" muted className="px-0.5 font-medium" />
            <div className="flex flex-col gap-1">
              {pullRequest != null ? (
                <PrListRow
                  provider="GitHub"
                  icon={GitFork}
                  identifier={`#${pullRequest.number}`}
                  title={pullRequest.title}
                  state={pullRequestMeta(pullRequest.state).label}
                  isSelected={activeProvider === 'github'}
                  onClick={() => setSelectedProvider('github')}
                />
              ) : null}
              {mergeRequest != null && mergeRequestState != null ? (
                <PrListRow
                  provider="GitLab"
                  icon={GitMerge}
                  identifier={`!${mergeRequest.iid}`}
                  title={mergeRequest.title}
                  state={pullRequestMeta(mergeRequestState).label}
                  isSelected={activeProvider === 'gitlab'}
                  onClick={() => setSelectedProvider('gitlab')}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        {activeProvider === 'gitlab' ? (
          <GitlabMrStrip sessionId={sessionId} />
        ) : (
          <GithubPrCard session={session} isPrReview={isPrReview} />
        )}
      </div>
    </PaneShell>
  );
};

const GithubPrCard = ({ session, isPrReview }: { session: Session; isPrReview: boolean }) => {
  const sessionId = session.id as SessionId;
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const branchPrs = useAppStore((s) => s.sessionGithubPrs[sessionId] ?? EMPTY_ARRAY);
  const selectedPrNumber = useAppStore((s) => s.sessionSelectedPrNumber[sessionId] ?? null);
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const branch = useAppStore((s) => s.sessionBranches[sessionId] ?? null);
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const workspaceIntegrations = useAppStore(
    (s) => s.workspaceIntegrations[session.workspaceId] ?? EMPTY_ARRAY,
  );
  const remoteKind = useRemoteHostKind(session.workspaceId);
  const isGithubConnected = resolveIntegrationConnection({
    provider: 'github',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
  }).isConnected;
  const selectedPr =
    selectedPrNumber != null
      ? (branchPrs.find((candidate) => candidate.number === selectedPrNumber) ?? null)
      : null;
  const pr = selectedPr ?? github?.pr ?? null;
  const detail = github?.detail ?? null;
  const linkedIssues = github?.linkedIssues ?? [];
  const codeHostTasks = externalTasks.filter(
    (task) => task.provider === 'github' || task.provider === 'gitlab',
  );
  const loading = github?.loading ?? false;
  const error = github?.error ?? null;

  const openStudio = () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-github-session', { detail: { sessionId } }));
  const refresh = () => void refreshSessionPr(sessionId, { force: true });

  if (!pr && !isGithubConnected) {
    return (
      <div className="animate-fade-in rounded-lg border border-dashed border-border-soft bg-elevated/40">
        <MissingGithubRemoteEmptyState />
      </div>
    );
  }

  if (!pr && isPrReview) {
    return (
      <div className="animate-fade-in flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-8 py-8 text-center">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full bg-indigo-400/15"
        >
          <GitPullRequest size={24} className="text-indigo-500" />
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <h2 className="text-base font-semibold text-foreground">External review session</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            This session reviews someone else&rsquo;s pull request, so there is no PR to open from
            here. Draft and publish comments from the review board.
          </p>
        </div>
      </div>
    );
  }

  if (!pr) {
    const hasLinkedWork = linkedIssues.length > 0 || codeHostTasks.length > 0;
    if (!hasLinkedWork) {
      return (
        <div className="animate-fade-in relative flex flex-col items-center gap-5 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-8 py-8 text-center">
          <div className="absolute right-3 top-3">
            <RefreshIconButton
              label="refresh PR status"
              iconSize={12}
              onClick={refresh}
              isLoading={loading}
              error={error}
            />
          </div>
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-primary/10"
          >
            <GitPullRequest size={24} className="text-primary" />
          </span>
          <div className="flex flex-col items-center gap-1.5">
            <h2 className="text-base font-semibold text-foreground">Open a pull request</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Turn this session&rsquo;s work into a PR. Fill in the title and description, or hand
              it to an agent that writes them from your commits.
            </p>
            <p className="text-xs text-muted-foreground/70">
              No issues or external tasks are linked to this session yet.
            </p>
            {branch != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 font-mono text-2xs text-muted-foreground ring-1 ring-border-soft/60">
                <GitBranch size={11} aria-hidden className="shrink-0" />
                <span className="truncate text-foreground/80">{branch}</span>
              </span>
            )}
          </div>
          <Button onClick={openStudio}>
            Open a pull request
            <ArrowUpRight size={13} aria-hidden className="ml-1.5 shrink-0 opacity-70" />
          </Button>
        </div>
      );
    }
    return (
      <div className="animate-fade-in flex flex-col gap-3">
        <LinkedIssuesSection issues={linkedIssues} />
        <ExternalTasksSection tasks={codeHostTasks} />
        <div className="relative flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-soft bg-elevated/40 px-4 py-4">
          <div className="absolute right-3 top-3">
            <RefreshIconButton
              label="refresh PR status"
              iconSize={12}
              onClick={refresh}
              isLoading={loading}
              error={error}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">No pull request yet</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Turn this session&rsquo;s work into a PR when it is ready.
            </p>
          </div>
          {branch != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 font-mono text-2xs text-muted-foreground ring-1 ring-border-soft/60">
              <GitBranch size={11} aria-hidden className="shrink-0" />
              <span className="truncate text-foreground/80">{branch}</span>
            </span>
          )}
          <Button size="sm" onClick={openStudio}>
            Open a pull request
            <ArrowUpRight size={13} aria-hidden className="ml-1.5 shrink-0 opacity-70" />
          </Button>
        </div>
      </div>
    );
  }

  const ciState = computeCiState(detail?.checks ?? []);
  const unresolved = (detail?.comments ?? []).filter(
    (c) => c.source === 'review' && c.resolved === false,
  ).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-elevated px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            {branchPrs.length > 1 ? (
              <PrSwitcher
                prs={branchPrs}
                selected={pr.number}
                onSelect={(prNumber) => void selectSessionPr(sessionId, prNumber)}
              />
            ) : (
              <PullRequestChip state={pr.state} variant="badge" number={pr.number} iconSize={12} />
            )}
            <CiBadge state={ciState} />
          </div>
          <h2 className="text-balance text-sm font-semibold leading-snug text-foreground">
            {pr.title}
          </h2>
        </div>
        <RefreshIconButton
          label="refresh PR status"
          iconSize={12}
          onClick={refresh}
          isLoading={loading}
          error={error}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <GitBranch size={11} aria-hidden className="shrink-0" />
          <span className="truncate font-medium text-foreground/80">{pr.headBranch}</span>
          <span className="text-muted-foreground/50">→</span>
          <span className="truncate">{pr.baseBranch}</span>
        </span>
        {pr.reviewDecision != null ? (
          <ReviewBadge decision={pr.reviewDecision} />
        ) : (
          <span>No review decision</span>
        )}
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={11} aria-hidden />
          <span className="tabular-nums">{unresolved}</span>
          <span>unresolved</span>
        </span>
      </div>

      <LinkedIssuesSection issues={linkedIssues} />
      <ExternalTasksSection tasks={codeHostTasks} />

      <button
        type="button"
        onClick={openStudio}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08]"
      >
        Open PR
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

type LinkedIssuesSectionProps = {
  readonly issues: ReadonlyArray<LinkedIssue>;
};

const LinkedIssuesSection = ({ issues }: LinkedIssuesSectionProps) => {
  if (issues.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow label="Linked issues" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-1">
        {issues.map((issue) => (
          <a
            key={issue.url}
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg bg-muted/25 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <span className="shrink-0 font-mono">#{issue.number}</span>
            <span className="min-w-0 flex-1 truncate">{issue.title ?? 'GitHub issue'}</span>
            <ArrowUpRight size={12} aria-hidden className="shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
};

type ExternalTasksSectionProps = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
};

const ExternalTasksSection = ({ tasks }: ExternalTasksSectionProps) => {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow label="External tasks" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <ExternalTaskChip
            key={`${task.provider}:${task.externalId}`}
            task={task}
            appearance="row"
          />
        ))}
      </div>
    </div>
  );
};

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
