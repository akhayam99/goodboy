import { useMemo, useState } from 'react';
import { ArrowRight, GitBranch, GitFork, GitMerge, MessageSquare } from 'lucide-react';
import { Button, EmptyState, Eyebrow } from '@goodboy/ui';
import type {
  LinkedIssue,
  PullRequestStateKind,
  Session,
  SessionExternalTask,
  SessionId,
  Workspace,
} from '@goodboy/types';
import { PullRequestChip, pullRequestMeta } from '../../../../github/components/PullRequestChip';
import { PrChecksChip } from '../../../../github/components/PrChecksChip';
import { ReviewDecisionChip } from '../../../../github/components/ReviewDecisionChip';
import { PrSwitcher } from '../../../../github/components/GitHubStudio/PrSwitcher';
import { ExternalTaskChip } from '../../../../integrations/components/ExternalTaskChip';
import { PROVIDER_LENS } from '../../../../integrations/providerLens';
import { GitlabMrStrip } from '../../../../context/components/ContextPanel/strips/GitlabMrStrip';
import { MissingGithubRemoteEmptyState } from '../../../../github/components/MissingGithubRemoteEmptyState';
import { resolveIntegrationConnection } from '../../../../integrations/connection';
import { useRemoteHostKind } from '../../../../worktree/useRemoteHostKind';
import { RefreshIconButton } from '../../../../../shared/components/RefreshIconButton';
import { ExternalRefActions } from '../../../../../shared/components/ExternalRefActions';
import { BranchPair } from '../../../../../shared/components/BranchPair';
import { workspaceMountName } from '../../../../../shared/utils/workspaceMountName';
import { EMPTY_ARRAY, useAppStore, type LensKind } from '../../../../../store';
import { isPrReviewSession } from '../../../../../store/slices/session-view';
import { PaneShell } from './PaneShell';
import { PrListRow } from './PrListRow';
import { useSessionRepo } from '../../../../../store/slices/worktrees/useSessionRepo';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

type PullRequestProvider = 'github' | 'gitlab';

export const PrPane = ({ session, onSelectLens }: Props) => {
  const sessionId = session.id as SessionId;
  const remoteKind = useRemoteHostKind({ sessionId });
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
          <GithubPrCard session={session} isPrReview={isPrReview} onSelectLens={onSelectLens} />
        )}
      </div>
    </PaneShell>
  );
};

const GithubPrCard = ({
  session,
  isPrReview,
  onSelectLens,
}: {
  session: Session;
  isPrReview: boolean;
  onSelectLens: (lens: LensKind) => void;
}) => {
  const sessionId = session.id as SessionId;
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const branchPrs = useAppStore((s) => s.sessionGithubPrs[sessionId] ?? EMPTY_ARRAY);
  const selectedPrNumber = useAppStore((s) => s.sessionSelectedPrNumber[sessionId] ?? null);
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const branch = useSessionRepo({ sessionId })?.branch ?? null;
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY);
  const workspaceIntegrations = useAppStore(
    (s) => s.workspaceIntegrations[session.workspaceId] ?? EMPTY_ARRAY,
  );
  const workspace = useAppStore(
    (s) => s.workspaces.find((candidate) => candidate.id === session.workspaceId) ?? null,
  );
  const remoteKind = useRemoteHostKind({ sessionId });
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
        <MissingGithubRemoteEmptyState workspaceId={session.workspaceId} />
      </div>
    );
  }

  if (!pr && isPrReview) {
    return (
      <EmptyState
        bordered
        tone="info"
        icon={CONCEPT_ICONS.pr}
        title="External review session"
        description="This session reviews someone else’s pull request, so there is no PR to open from here. Draft and publish comments from the review board."
        size="lg"
        headingLevel={2}
        className="animate-fade-in py-8"
      />
    );
  }

  if (!pr) {
    const hasLinkedWork = linkedIssues.length > 0 || codeHostTasks.length > 0;
    if (!hasLinkedWork) {
      return (
        <EmptyState
          bordered
          tone="primary"
          icon={CONCEPT_ICONS.pr}
          title="Open a pull request"
          description="Turn this session’s work into a PR. Fill in the title and description, or hand it to an agent that writes them from your commits."
          size="lg"
          headingLevel={2}
          className="animate-fade-in relative py-8"
          action={
            <>
              <p className="text-xs text-muted-foreground/70">
                No issues or external tasks are linked to this session yet.
              </p>
              <div className="absolute right-3 top-3">
                <RefreshIconButton
                  label="refresh PR status"
                  iconSize={12}
                  onClick={refresh}
                  isLoading={loading}
                  error={error}
                />
              </div>
              {branch != null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 font-mono text-2xs text-muted-foreground ring-1 ring-border-soft/60">
                  <GitBranch size={11} aria-hidden className="shrink-0" />
                  <span className="truncate text-foreground/80">{branch}</span>
                </span>
              ) : null}
              <Button onClick={openStudio}>
                Open a pull request
                <ArrowRight size={13} aria-hidden className="shrink-0 opacity-70" />
              </Button>
            </>
          }
        />
      );
    }
    return (
      <div className="animate-fade-in flex flex-col gap-3">
        <LinkedIssuesSection issues={linkedIssues} />
        <ExternalTasksSection
          tasks={codeHostTasks}
          workspace={workspace}
          onSelectLens={onSelectLens}
        />
        <EmptyState
          bordered
          tone="primary"
          icon={CONCEPT_ICONS.pr}
          title="No pull request yet"
          description="Turn this session’s work into a PR when it is ready."
          className="relative items-start px-4 py-4 text-left"
          action={
            <>
              <div className="absolute right-3 top-3">
                <RefreshIconButton
                  label="refresh PR status"
                  iconSize={12}
                  onClick={refresh}
                  isLoading={loading}
                  error={error}
                />
              </div>
              {branch != null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 font-mono text-2xs text-muted-foreground ring-1 ring-border-soft/60">
                  <GitBranch size={11} aria-hidden className="shrink-0" />
                  <span className="truncate text-foreground/80">{branch}</span>
                </span>
              ) : null}
              <Button size="sm" onClick={openStudio}>
                Open a pull request
                <ArrowRight size={13} aria-hidden className="shrink-0 opacity-70" />
              </Button>
            </>
          }
        />
      </div>
    );
  }

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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-muted-foreground">
        <BranchPair headBranch={pr.headBranch} baseBranch={pr.baseBranch} />
        <ReviewDecisionChip decision={pr.reviewDecision} />
        <PrChecksChip checks={detail?.checks ?? []} />
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={11} aria-hidden />
          <span className="tabular-nums">{unresolved}</span>
          <span>unresolved</span>
        </span>
      </div>

      <LinkedIssuesSection issues={linkedIssues} />
      <ExternalTasksSection
        tasks={codeHostTasks}
        workspace={workspace}
        onSelectLens={onSelectLens}
      />

      <button
        type="button"
        onClick={openStudio}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08]"
      >
        Open PR
        <ArrowRight size={13} aria-hidden className="shrink-0 opacity-70" />
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
  const [expandedIssueUrl, setExpandedIssueUrl] = useState<string | null>(null);

  if (issues.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow label="Linked issues" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-1">
        {issues.map((issue) => {
          const isExpanded = expandedIssueUrl === issue.url;
          return (
            <div key={issue.url} className="flex flex-col gap-2 rounded-lg bg-muted/25 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedIssueUrl(isExpanded ? null : issue.url)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <span className="shrink-0 font-mono">#{issue.number}</span>
                  <span className="min-w-0 flex-1 truncate">{issue.title ?? 'GitHub issue'}</span>
                  <ArrowRight size={12} aria-hidden className="shrink-0" />
                </button>
                <ExternalRefActions
                  url={issue.url}
                  label={`issue #${issue.number}`}
                  hostLabel="GitHub"
                />
              </div>
              {isExpanded ? (
                <div
                  role="region"
                  aria-label={`issue #${issue.number} details`}
                  className="rounded-md bg-background/50 px-3 py-2 text-xs text-muted-foreground"
                >
                  {issue.closes
                    ? 'This issue closes when the pull request merges.'
                    : 'This issue is linked without closing on merge.'}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

type ExternalTasksSectionProps = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly workspace: Workspace | null;
  readonly onSelectLens: (lens: LensKind) => void;
};

const ExternalTasksSection = ({ tasks, workspace, onSelectLens }: ExternalTasksSectionProps) => {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow label="External tasks" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <ExternalTaskChip
            key={`${task.provider}:${task.externalId}:${task.mountWorkspaceId ?? ''}`}
            task={task}
            appearance="row"
            navigation="internal"
            ariaLabel={`open ${task.identifier} integration`}
            onClick={() => onSelectLens(PROVIDER_LENS[task.provider])}
            repoLabel={
              workspaceMountName({
                workspace,
                mountWorkspaceId: task.mountWorkspaceId,
              }) ?? undefined
            }
          />
        ))}
      </div>
    </div>
  );
};
