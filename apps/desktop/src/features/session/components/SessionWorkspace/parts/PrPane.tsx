import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, GitBranch, GitFork, GitMerge, Unlink } from 'lucide-react';
import { Button, Eyebrow, Skeleton } from '@goodboy/ui';
import type {
  LinkedIssue,
  PullRequestState,
  Session,
  SessionExternalTask,
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
import { gitlabMrStateKind } from '../../../../integrations/gitlab/gitlabMrStateKind';
import { closingIssueReferences } from '../../../../github/closingIssueReferences';
import { closingReferenceLines } from '../../../../github/closingReferenceLines';
import { removeClosingReference } from '../../../../github/removeClosingReference';
import { RefreshIconButton } from '../../../../../shared/components/RefreshIconButton';
import { ExternalRefActions } from '../../../../../shared/components/ExternalRefActions';
import { GhostActionButton } from '../../../../../shared/components/GhostActionButton';
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
import type { RemoteHostKind } from '../../../../../shared/lib/remoteHost';
import { branchRequests } from '../../../branchRequests';
import { buildWorkItems, type WorkItem, type WorkItemGroups } from '../../../workItems';
import { LinkIssueToPrPopover } from './LinkIssueToPrPopover';

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

const PrPaneSkeleton = () => (
  <div className="flex flex-col gap-4" role="status" aria-label="Loading pull request">
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-24 rounded" />
      <Skeleton className="h-4 w-3/4 rounded" />
    </div>
    <div className="flex flex-col gap-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-lg" />
      ))}
    </div>
  </div>
);

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
  const mergeRequestState = mergeRequest == null ? null : gitlabMrStateKind({ mr: mergeRequest });
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
  const [unlinkingIssueNumber, setUnlinkingIssueNumber] = useState<number | null>(null);
  const github = useAppStore((s) => s.sessionGithub[sessionId]);
  const branchPrs = useAppStore((s) => s.sessionGithubPrs[sessionId] ?? EMPTY_ARRAY);
  const mergeRequest = useAppStore((s) => s.sessionGitlabMr[sessionId]?.mr ?? null);
  const selectedPrNumber = useAppStore((s) => s.sessionSelectedPrNumber[sessionId] ?? null);
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const editPr = useAppStore((s) => s.editPr);
  const setFocusedGithubIssueNumber = useAppStore((s) => s.setFocusedGithubIssueNumber);
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
  const isInitialLoad = loading && (github?.fetchedAt ?? null) == null;
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
    branchPrs: branchRequests({
      prs: branchPrs.length > 0 ? branchPrs : pr != null ? [pr] : [],
      mr: mergeRequest,
      branch,
    }),
  });

  const githubTasks = codeHostTasks.filter((task) => task.provider === 'github');
  const linkedIssueNumbers = new Set(linkedIssues.map((issue) => issue.number));
  const linkCandidates =
    pr === null
      ? []
      : closingIssueReferences({ tasks: githubTasks, branch, body: pr.body }).filter(
          (reference) => !linkedIssueNumbers.has(reference.number),
        );
  const unlinkableIssueNumbers =
    pr === null ? new Set<number>() : closingReferenceLines({ body: pr.body });
  const linkIssueAction =
    pr !== null && githubTasks.length > 0 ? (
      <LinkIssueToPrPopover
        sessionId={sessionId}
        prNumber={pr.number}
        body={pr.body}
        candidates={linkCandidates}
      />
    ) : null;

  const openLinkedIssue = (issueNumber: number) => {
    setFocusedGithubIssueNumber(sessionId, issueNumber);
    onSelectLens('github_issue');
  };

  const openWorkItem = (task: SessionExternalTask) => {
    if (task.provider === 'github') {
      setFocusedGithubIssueNumber(sessionId, Number(task.externalId));
    }
    onSelectLens(PROVIDER_LENS[task.provider]);
  };

  const handleUnlinkIssue = async (issueNumber: number) => {
    if (pr === null) {
      return;
    }
    setUnlinkingIssueNumber(issueNumber);
    await editPr(sessionId, pr.number, {
      body: removeClosingReference({ body: pr.body, number: issueNumber }),
    }).catch(() => undefined);
    setUnlinkingIssueNumber(null);
  };

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

  if (isInitialLoad) {
    return shell({ children: <PrPaneSkeleton /> });
  }

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
        Draft a pull request
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
          <LinkedIssuesSection issues={linkedIssues} onOpenIssue={openLinkedIssue} />
          <WorkItemsSections
            groups={workItems}
            workspace={workspace}
            onOpenWorkItem={openWorkItem}
          />
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
      <LinkedIssuesSection
        issues={linkedIssues}
        onOpenIssue={openLinkedIssue}
        action={linkIssueAction}
        unlinkableNumbers={unlinkableIssueNumbers}
        unlinkingNumber={unlinkingIssueNumber}
        onUnlink={(issueNumber) => void handleUnlinkIssue(issueNumber)}
      />
      <WorkItemsSections groups={workItems} workspace={workspace} onOpenWorkItem={openWorkItem} />
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
  readonly onOpenIssue: (issueNumber: number) => void;
  readonly action?: ReactNode;
  readonly unlinkableNumbers?: ReadonlySet<number>;
  readonly unlinkingNumber?: number | null;
  readonly onUnlink?: (issueNumber: number) => void;
};

const LinkedIssuesSection = ({
  issues,
  onOpenIssue,
  action = null,
  unlinkableNumbers,
  unlinkingNumber = null,
  onUnlink,
}: LinkedIssuesSectionProps) => {
  if (issues.length === 0 && action === null) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Eyebrow label="Linked issues" muted className="px-0.5 font-medium" />
        {action}
      </div>
      <div className="flex flex-col gap-1">
        {issues.map((issue) => (
          <LinkedWorkRow
            key={issue.url}
            leading={{ kind: 'icon', icon: GitBranch, tone: 'info', label: 'GitHub' }}
            identifier={`#${issue.number}`}
            title={issue.title ?? 'GitHub issue'}
            navigation="internal"
            onClick={() => onOpenIssue(issue.number)}
            actions={
              <span className="inline-flex shrink-0 items-center gap-0.5">
                {unlinkableNumbers?.has(issue.number) === true && onUnlink != null && (
                  <span className="opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <GhostActionButton
                      icon={Unlink}
                      tone="danger"
                      label="Unlink"
                      ariaLabel={`Unlink issue #${issue.number}`}
                      disabled={unlinkingNumber !== null}
                      onClick={() => onUnlink(issue.number)}
                    />
                  </span>
                )}
                <ExternalRefActions
                  url={issue.url}
                  label={`issue #${issue.number}`}
                  hostLabel="GitHub"
                />
              </span>
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
  readonly onOpenWorkItem: (task: SessionExternalTask) => void;
};

const WorkItemsSections = ({ groups, workspace, onOpenWorkItem }: WorkItemsSectionsProps) => (
  <>
    <WorkItemsSection
      label="External tasks"
      items={groups.current}
      workspace={workspace}
      onOpenWorkItem={onOpenWorkItem}
    />
    <WorkItemsSection
      label={`Completed work (${groups.history.length})`}
      items={groups.history}
      workspace={workspace}
      onOpenWorkItem={onOpenWorkItem}
    />
  </>
);

type WorkItemsSectionProps = {
  readonly label: string;
  readonly items: ReadonlyArray<WorkItem>;
  readonly workspace: Workspace | null;
  readonly onOpenWorkItem: (task: SessionExternalTask) => void;
};

const WorkItemsSection = ({ label, items, workspace, onOpenWorkItem }: WorkItemsSectionProps) => {
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
            navigation="internal"
            ariaLabel={`open ${task.identifier} integration`}
            onClick={() => onOpenWorkItem(task)}
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
