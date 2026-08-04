import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, GitBranch, GitFork, GitMerge } from 'lucide-react';
import { Button, Eyebrow } from '@goodboy/ui';
import type {
  LinkedIssue,
  PullRequestState,
  PullRequestStateKind,
  Session,
  SessionId,
  Workspace,
} from '@goodboy/types';
import { PullRequestChip, pullRequestMeta } from '../../../../github/components/PullRequestChip';
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
import { workspaceMountName } from '../../../../../shared/utils/workspaceMountName';
import { EMPTY_ARRAY, useAppStore, type LensKind } from '../../../../../store';
import { isPrReviewSession } from '../../../../../store/slices/session-view';
import {
  HeaderBand,
  StudioDetailLayout,
  StudioDetailTabs,
} from '../../../../../shared/components/StudioDetail';
import { IssueStateBadge } from '../../../../../shared/components/IssueStateBadge';
import { resolveDetailFields, sessionPullRequestFields } from '../../../../../shared/detail-fields';
import { useSessionRepo } from '../../../../../store/slices/worktrees/useSessionRepo';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { LensEmptyState } from '../../../../../shared/components/LensEmptyState';
import { LinkedWorkRow } from '../../../../../shared/components/LinkedWorkRow';
import { openUrl } from '../../../../../shared/lib/editor';
import type { RemoteHostKind } from '../../../../../shared/lib/remoteHost';
import { buildWorkItems, type WorkItem, type WorkItemGroups } from '../../../workItems';

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
  const sessionBranch = useSessionRepo({ sessionId })?.branch ?? null;
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

  const providerTabs = hasBothProviders ? (
    <StudioDetailTabs
      ariaLabel="Code host"
      value={activeProvider}
      onChange={setSelectedProvider}
      options={[
        { value: 'github', label: 'GitHub', icon: GitFork },
        { value: 'gitlab', label: 'GitLab', icon: GitMerge },
      ]}
    />
  ) : undefined;

  if (activeProvider === 'gitlab') {
    return (
      <StudioDetailLayout
        fit="fill"
        header={
          <HeaderBand
            meta={<SessionBranchTag branch={sessionBranch} />}
            title={hostTitle({ remoteKind, hasBothProviders })}
            subtitle={
              mergeRequest != null && mergeRequestState != null ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                    !{mergeRequest.iid}
                  </span>
                  <IssueStateBadge>{pullRequestMeta(mergeRequestState).label}</IssueStateBadge>
                  <span className="min-w-0 truncate text-sm text-muted-foreground">
                    {mergeRequest.title}
                  </span>
                </div>
              ) : null
            }
          />
        }
        {...(providerTabs != null && { tabs: providerTabs })}
      >
        <GitlabMrStrip sessionId={sessionId} onOpenStudio={openStudio} />
      </StudioDetailLayout>
    );
  }

  return (
    <GithubPrCard
      session={session}
      isPrReview={isPrReview}
      onSelectLens={onSelectLens}
      remoteKind={remoteKind}
      onOpenStudio={openStudio}
      hasBothProviders={hasBothProviders}
      {...(providerTabs != null && { tabs: providerTabs })}
    />
  );
};

const GithubPrCard = ({
  session,
  isPrReview,
  onSelectLens,
  remoteKind,
  onOpenStudio,
  hasBothProviders,
  tabs,
}: {
  session: Session;
  isPrReview: boolean;
  onSelectLens: (lens: LensKind) => void;
  remoteKind: RemoteHostKind | null;
  onOpenStudio: () => void;
  hasBothProviders: boolean;
  tabs?: ReactNode;
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
  const checks = detail?.checks ?? EMPTY_ARRAY;
  const unresolved = (detail?.comments ?? []).filter(
    (c) => c.source === 'review' && c.resolved === false,
  ).length;
  const properties = useMemo(
    () =>
      pr === null
        ? null
        : resolveDetailFields({
            registry: sessionPullRequestFields,
            entity: { pr, checks, unresolved },
          }),
    [checks, pr, unresolved],
  );
  const refresh = () => void refreshSessionPr(sessionId, { force: true });

  const workItems = buildWorkItems({
    tasks: codeHostTasks,
    currentBranch: branch,
    branchPrs: branchPrs.length > 0 ? branchPrs : pr != null ? [pr] : [],
  });

  const shell = ({ children }: { readonly children: ReactNode }) => (
    <StudioDetailLayout
      fit="fill"
      header={
        <HeaderBand
          meta={<SessionBranchTag branch={branch} />}
          title={hostTitle({ remoteKind, hasBothProviders })}
        />
      }
      {...(tabs != null && { tabs })}
    >
      {children}
    </StudioDetailLayout>
  );

  if (!pr && remoteKind !== 'github') {
    return shell({ children: <MissingGithubRemoteEmptyState /> });
  }

  if (!pr && !isGithubConnected) {
    return shell({
      children: (
        <MissingGithubTokenEmptyState
          workspaceId={session.workspaceId}
          onConnected={() => void githubConnection.refresh()}
        />
      ),
    });
  }

  if (!pr && isPrReview) {
    return shell({
      children: (
        <LensEmptyState
          tone={CONCEPT_TONE.pr}
          icon={CONCEPT_ICONS.pr}
          title="External review session"
          description="This session reviews someone else’s pull request, so there is no PR to open from here. Draft and publish comments from the review board."
        />
      ),
    });
  }

  if (!pr) {
    const hasLinkedWork = linkedIssues.length > 0 || codeHostTasks.length > 0;
    const openAction = (
      <Button size="sm" onClick={onOpenStudio}>
        Open in code host
        <ArrowRight size={13} aria-hidden className="shrink-0 opacity-70" />
      </Button>
    );
    if (!hasLinkedWork) {
      return shell({
        children: (
          <LensEmptyState
            tone={CONCEPT_TONE.pr}
            icon={CONCEPT_ICONS.pr}
            title="Open a pull or merge request"
            description="No issues or external tasks are linked to this session yet. Turn its work into a pull or merge request, or hand it to an agent that writes one from your commits."
            action={openAction}
          />
        ),
      });
    }
    return shell({
      children: (
        <>
          <LinkedIssuesSection issues={linkedIssues} />
          <WorkItemsSections groups={workItems} workspace={workspace} onSelectLens={onSelectLens} />
          <LensEmptyState
            tone={CONCEPT_TONE.pr}
            icon={CONCEPT_ICONS.pr}
            title="No pull or merge request yet"
            description="Turn this session's work into a pull or merge request when it is ready."
            action={openAction}
          />
        </>
      ),
    });
  }

  return (
    <StudioDetailLayout
      fit="fill"
      header={
        <HeaderBand
          meta={<SessionBranchTag branch={branch} />}
          title={hostTitle({ remoteKind, hasBothProviders })}
          subtitle={
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PullRequestChip state={pr.state} variant="badge" number={pr.number} iconSize={12} />
              <span className="min-w-0 truncate text-sm text-muted-foreground">{pr.title}</span>
            </div>
          }
          actions={
            <>
              <RefreshIconButton
                label="Refresh PR status"
                iconSize={12}
                onClick={refresh}
                isLoading={loading}
                error={error}
              />
              <Button size="sm" variant="ghost" onClick={onOpenStudio}>
                Review this pull request
                <ArrowRight size={13} aria-hidden className="shrink-0 opacity-70" />
              </Button>
            </>
          }
        />
      }
      {...(tabs != null && { tabs })}
      {...(properties != null && { properties })}
    >
      <LinkedPullRequestsSection
        prs={branchPrs.length > 0 ? branchPrs : [pr]}
        branch={branch}
        selectedNumber={pr.number}
        onSelect={(prNumber) => void selectSessionPr(sessionId, prNumber)}
      />
      <LinkedIssuesSection issues={linkedIssues} />
      <WorkItemsSections groups={workItems} workspace={workspace} onSelectLens={onSelectLens} />
      {error ? (
        <span className="text-2xs text-danger" title={error}>
          {error}
        </span>
      ) : null}
    </StudioDetailLayout>
  );
};

type LinkedPullRequestsSectionProps = {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly branch: string | null;
  readonly selectedNumber: number;
  readonly onSelect: (prNumber: number) => void;
};

const branchScopedLabel = ({
  count,
  branch,
}: {
  readonly count: number;
  readonly branch: string | null;
}): string => {
  const noun = count === 1 ? 'Pull request' : `Pull requests (${count})`;
  return branch == null || branch === '' ? noun : `${noun} on ${branch}`;
};

const LinkedPullRequestsSection = ({
  prs,
  branch,
  selectedNumber,
  onSelect,
}: LinkedPullRequestsSectionProps) => {
  if (prs.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow
        label={branchScopedLabel({ count: prs.length, branch })}
        muted
        className="px-0.5 font-medium"
      />
      <div className="flex flex-col gap-1">
        {prs.map((candidate) => (
          <LinkedWorkRow
            key={candidate.number}
            leading={{ kind: 'glyph', provider: 'github' }}
            identifier={`#${candidate.number}`}
            title={candidate.title}
            isSelected={candidate.number === selectedNumber}
            ariaLabel={`Show pull request #${candidate.number}`}
            tooltip={
              candidate.number === selectedNumber
                ? 'Showing this pull request'
                : 'Show this pull request instead'
            }
            attribution={
              <IssueStateBadge>{pullRequestMeta(candidate.state).label}</IssueStateBadge>
            }
            onClick={() => onSelect(candidate.number)}
            actions={
              <ExternalRefActions
                url={candidate.url}
                label={`pull request #${candidate.number}`}
                hostLabel="GitHub"
              />
            }
          />
        ))}
      </div>
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

type WorkItemsSectionsProps = {
  readonly groups: WorkItemGroups;
  readonly workspace: Workspace | null;
  readonly onSelectLens: (lens: LensKind) => void;
};

const WorkItemsSections = ({ groups, workspace, onSelectLens }: WorkItemsSectionsProps) => (
  <>
    <WorkItemsSection
      label="External tasks"
      items={groups.current}
      workspace={workspace}
      onSelectLens={onSelectLens}
    />
    <WorkItemsSection
      label={`Completed work (${groups.history.length})`}
      items={groups.history}
      workspace={workspace}
      onSelectLens={onSelectLens}
    />
  </>
);

type WorkItemsSectionProps = {
  readonly label: string;
  readonly items: ReadonlyArray<WorkItem>;
  readonly workspace: Workspace | null;
  readonly onSelectLens: (lens: LensKind) => void;
};

const WorkItemsSection = ({ label, items, workspace, onSelectLens }: WorkItemsSectionProps) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow label={label} muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-1">
        {items.map(({ key, task, branch }) => (
          <ExternalTaskChip
            key={key}
            task={task}
            branchLabel={branch ?? undefined}
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
