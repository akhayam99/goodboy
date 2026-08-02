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
import { MissingGithubTokenEmptyState } from '../../../../github/components/MissingGithubTokenEmptyState';
import { resolveIntegrationConnection } from '../../../../integrations/connection';
import { useGithubConnection } from '../../../../integrations/github/useGithubConnection';
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
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { LensEmptyState } from '../../../../../shared/components/LensEmptyState';
import { LinkedWorkRow } from '../../../../../shared/components/LinkedWorkRow';
import { openUrl } from '../../../../../shared/lib/editor';
import type { RemoteHostKind } from '../../../../../shared/lib/remoteHost';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

type PullRequestProvider = 'github' | 'gitlab';

type HostTitleParams = {
  readonly remoteKind: RemoteHostKind | null;
  readonly hasBothProviders: boolean;
};

const hostTitle = ({ remoteKind, hasBothProviders }: HostTitleParams): string => {
  if (hasBothProviders) {
    return 'Code host work';
  }
  if (remoteKind === 'gitlab') {
    return 'GitLab';
  }
  if (remoteKind === 'github') {
    return 'GitHub';
  }
  return 'Code host work';
};

const SessionBranchTag = ({ branch }: { readonly branch: string | null }) =>
  branch == null ? null : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 font-mono text-2xs text-muted-foreground ring-1 ring-border-soft/60">
      <GitBranch size={11} aria-hidden className="shrink-0" />
      <span className="truncate text-foreground/80">{branch}</span>
    </span>
  );

type SessionStudioOpenEvent = 'goodboy:open-github-session' | 'goodboy:open-gitlab-mr';

const resolveSessionStudioOpenEvent = ({
  remoteKind,
}: {
  readonly remoteKind: RemoteHostKind | null;
}): SessionStudioOpenEvent => {
  switch (remoteKind) {
    case 'gitlab':
      return 'goodboy:open-gitlab-mr';
    case 'github':
    case 'other':
    case 'none':
    case null:
      return 'goodboy:open-github-session';
    default: {
      const unexpectedKind: never = remoteKind;
      return unexpectedKind;
    }
  }
};

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
  const openStudio = () =>
    window.dispatchEvent(
      new CustomEvent(resolveSessionStudioOpenEvent({ remoteKind }), { detail: { sessionId } }),
    );

  return (
    <PaneShell
      title={hostTitle({ remoteKind, hasBothProviders })}
      description="Linked issues and pull or merge request for this session."
    >
      <div className="flex flex-col gap-3">
        {hasBothProviders ? (
          <div className="flex flex-col gap-1.5">
            <Eyebrow label="Code host requests" muted className="px-0.5 font-medium" />
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
          <GitlabMrStrip sessionId={sessionId} onOpenStudio={openStudio} />
        ) : (
          <GithubPrCard
            session={session}
            isPrReview={isPrReview}
            onSelectLens={onSelectLens}
            remoteKind={remoteKind}
            onOpenStudio={openStudio}
          />
        )}
      </div>
    </PaneShell>
  );
};

const GithubPrCard = ({
  session,
  isPrReview,
  onSelectLens,
  remoteKind,
  onOpenStudio,
}: {
  session: Session;
  isPrReview: boolean;
  onSelectLens: (lens: LensKind) => void;
  remoteKind: RemoteHostKind | null;
  onOpenStudio: () => void;
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
  const githubConnection = useGithubConnection({ workspaceId: session.workspaceId });
  const isGithubConnected = resolveIntegrationConnection({
    provider: 'github',
    integrations: workspaceIntegrations,
    remoteKind,
    externalTasks,
    isGithubAuthenticated:
      githubConnection.isResolved === false || githubConnection.isAuthenticated,
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
  const refresh = () => void refreshSessionPr(sessionId, { force: true });

  if (!pr && remoteKind !== 'github') {
    return (
      <div className="animate-fade-in rounded-lg border border-dashed border-border-soft bg-elevated/40">
        <MissingGithubRemoteEmptyState />
      </div>
    );
  }

  if (!pr && !isGithubConnected) {
    return (
      <div className="animate-fade-in rounded-lg border border-dashed border-border-soft bg-elevated/40">
        <MissingGithubTokenEmptyState
          workspaceId={session.workspaceId}
          onConnected={() => void githubConnection.refresh()}
        />
      </div>
    );
  }

  if (!pr && isPrReview) {
    return (
      <LensEmptyState
        tone={CONCEPT_TONE.pr}
        icon={CONCEPT_ICONS.pr}
        title="External review session"
        description="This session reviews someone else’s pull request, so there is no PR to open from here. Draft and publish comments from the review board."
        className="animate-fade-in"
      />
    );
  }

  if (!pr) {
    const hasLinkedWork = linkedIssues.length > 0 || codeHostTasks.length > 0;
    if (!hasLinkedWork) {
      return (
        <LensEmptyState
          tone={CONCEPT_TONE.pr}
          icon={CONCEPT_ICONS.pr}
          title="Open a pull or merge request"
          description="No issues or external tasks are linked to this session yet. Turn its work into a pull or merge request, or hand it to an agent that writes one from your commits."
          className="animate-fade-in"
          action={
            <div className="flex items-center gap-2">
              <SessionBranchTag branch={branch} />
              <Button size="sm" onClick={onOpenStudio}>
                Open in code host
                <ArrowRight size={13} aria-hidden className="shrink-0 opacity-70" />
              </Button>
            </div>
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
        <LensEmptyState
          tone={CONCEPT_TONE.pr}
          icon={CONCEPT_ICONS.pr}
          title="No pull or merge request yet"
          description="Turn this session's work into a pull or merge request when it is ready."
          action={
            <div className="flex items-center gap-2">
              <SessionBranchTag branch={branch} />
              <Button size="sm" onClick={onOpenStudio}>
                Open in code host
                <ArrowRight size={13} aria-hidden className="shrink-0 opacity-70" />
              </Button>
            </div>
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
        onClick={onOpenStudio}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground/[0.04] px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08]"
      >
        Open in code host
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
  if (issues.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow label="Linked issues" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-1">
        {issues.map((issue) => (
          <LinkedWorkRow
            key={issue.url}
            leading={{ kind: 'icon', icon: GitBranch, tone: 'info', label: 'GitHub' }}
            identifier={`#${issue.number}`}
            title={issue.title ?? 'GitHub issue'}
            navigation="external"
            onClick={() => void openUrl(issue.url)}
            actions={
              <ExternalRefActions
                url={issue.url}
                label={`issue #${issue.number}`}
                hostLabel="GitHub"
              />
            }
          />
        ))}
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
            navigation={task.provider === 'github' ? 'external' : 'internal'}
            ariaLabel={
              task.provider === 'github'
                ? `open ${task.identifier} in GitHub`
                : `open ${task.identifier} integration`
            }
            onClick={
              task.provider === 'github'
                ? () => void openUrl(task.url)
                : () => onSelectLens(PROVIDER_LENS[task.provider])
            }
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
