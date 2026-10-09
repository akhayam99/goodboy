import { useCallback, useEffect, useMemo, useState } from 'react';
import { PULL_REQUEST_NOUNS, REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import { PageColumn, PaneShell, SegmentedTabs } from '@goodboy/ui';
import type { PullRequestHost, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { refreshActiveRequest } from '../../../../store/slices/review-source/refreshActiveRequest';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { DiffRailScope } from '../../../diff/DiffRailScope';
import { DiffBaseBranchRow } from '../../../diff/components/SessionDiffPane/DiffBaseBranchRow';
import { useSessionDiff } from '../../../diff/hooks/useSessionDiff';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import { PushBanner } from '../../../resolve/components/ReviewFlow/PushBanner';
import { ReviewFlow } from '../../../resolve/components/ReviewFlow';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { useReviewPush } from '../../../resolve/components/ReviewFlow/useReviewPush';
import { useActiveReviewSource } from '../../../resolve/hooks/useActiveReviewSource';
import { isPushFailure } from '../../../resolve/reviewCommentState';
import { REVIEW_REQUEST_EVENT, isReviewRequest } from '../../../review/reviewRequest';
import { BranchDiffContext } from '../../branchDiffContext';
import { useBranchControls } from '../../hooks/useBranchControls';
import { useBitbucketRemote } from '../../hooks/useBitbucketRemote';
import { useBranchIdentity } from '../../hooks/useBranchIdentity';
import { useBranchTab } from '../../hooks/useBranchTab';
import { usePullRequestView } from '../../hooks/usePullRequestView';
import { capabilityReasonOf } from '../../pullRequestCapabilityReason';
import { distanceBehind } from '../../../../shared/lib/gitStatus';
import type { BranchReviewCounts } from '../../branchPrimary';
import { branchTabsOf } from '../../branchTabs';
import { BranchChecks } from '../BranchChecks';
import { BranchCommits } from '../BranchCommits';
import { BranchFiles } from '../BranchFiles';
import { BranchHeader } from '../BranchHeader';
import { NoPullRequest } from '../PullRequestTab/NoPullRequest';
import { PullRequestTab } from '../PullRequestTab';
import type { ReviewerRequest } from '../PullRequestTab/ReviewersProperty';
import { TabCount } from './TabCount';
import { TabActionsSlotContext } from '../../../../shared/components/TabActions/tabActionsSlotContext';

type Props = {
  readonly session: Session;
  readonly workingDir: string | null;
  readonly isActive?: boolean;
};

const tabLabelOf = ({
  host,
  label,
}: {
  readonly host: PullRequestHost;
  readonly label: string;
}): string => {
  const long = PULL_REQUEST_NOUNS[host].long;
  return host === 'github' ? label : `${long.charAt(0).toUpperCase()}${long.slice(1)}`;
};

export const BranchPage = ({ session, workingDir, isActive = true }: Props) => {
  const sessionId = session.id as SessionId;
  const identity = useBranchIdentity({ sessionId });
  const tab = useBranchTab({ sessionId, mountPath: identity.mountPath });
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const navigate = useAppStore((s) => s.navigate);
  const selectedThreadId = useAppStore((s) => s.branchThreadId[sessionId] ?? null);
  const openDiffLens = useAppStore((s) => s.openDiffLens);
  const diffFocus = useAppStore((s) => s.diffFocus[sessionId] ?? null);
  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const [tabActionsSlot, setTabActionsSlot] = useState<HTMLElement | null>(null);
  const historyMountId = identity.mount?.mountId ?? null;
  const commitCount = useAppStore((s) =>
    historyMountId === null ? null : (s.historyDrafts[historyMountId]?.commits.length ?? null),
  );
  const hasHistoryDraft = useAppStore(
    (s) => historyMountId !== null && s.historyDrafts[historyMountId] !== undefined,
  );
  const loadHistoryDraft = useAppStore((s) => s.loadHistoryDraft);
  const projectName = useAppStore(
    (s) => projectById(s.projects, identity.mount?.projectId ?? null)?.name ?? null,
  );
  const repo = useSessionRepo({ sessionId });
  const bitbucketRemote = useBitbucketRemote({
    sessionId,
    workspaceId: session.workspaceId,
    repoRoot: repo?.repoRoot ?? null,
  });
  const githubConnection = useGithubConnection({ workspaceId: session.workspaceId });
  const { entries: sources, source: activeSource } = useActiveReviewSource({ sessionId });
  const { entries } = useReviewEntries({ sessionId });
  const push = useReviewPush({ sessionId });
  const diff = useSessionDiff({
    sessionId,
    worktreePath: identity.mountPath,
    diffFocus,
    branchRevision: 0,
  });

  const { pr } = identity;
  const remoteKind = useMountRemoteHostKind({
    sessionId,
    repoRoot: identity.mount?.repoRoot ?? null,
  });
  const remoteHost: PullRequestHost =
    remoteKind === 'gitlab' ? 'gitlab' : bitbucketRemote.isBitbucket ? 'bitbucket' : 'github';
  const host: PullRequestHost = activeSource?.kind ?? (pr === null ? remoteHost : identity.host);
  const tabs = branchTabsOf({
    hasPullRequest: pr !== null,
    provider: activeSource?.kind ?? 'local',
  });
  const hasPushFailure = entries.some((entry) => isPushFailure({ row: entry.row }));
  const isPushBusy =
    push.phase.kind === 'preparing' ||
    push.phase.kind === 'pushing' ||
    push.phase.kind === 'syncing';

  const pushableIds = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            (entry.state === 'accepted' || entry.state === 'replied') &&
            entry.remote !== 'on_origin',
        )
        .map((entry) => entry.threadId),
    [entries],
  );
  const selectedPushIds = useMemo<ReadonlyArray<string> | undefined>(
    () =>
      tab === 'comments' && selectedThreadId !== null && pushableIds.includes(selectedThreadId)
        ? [selectedThreadId]
        : undefined,
    [pushableIds, selectedThreadId, tab],
  );

  const review = useMemo<BranchReviewCounts>(
    () => ({
      accepted: selectedPushIds?.length ?? pushableIds.length,
      replies: entries.filter((entry) => entry.remote === 'on_origin').length,
      failed: entries.filter(
        (entry) => entry.state === 'failed' && isPushFailure({ row: entry.row }),
      ).length,
      isPushing: entries.some((entry) => entry.row.thread.stage === 'publishing'),
    }),
    [entries, pushableIds, selectedPushIds],
  );

  const controls = useBranchControls({
    sessionId,
    worktreePath: identity.mountPath,
    pr,
    diff,
    review,
    remoteHost: host,
  });

  useEffect(() => {
    if (historyMountId === null || hasHistoryDraft) {
      return;
    }
    void loadHistoryDraft({ sessionId, mountId: historyMountId });
  }, [historyMountId, hasHistoryDraft, loadHistoryDraft, sessionId]);

  useEffect(
    () => () => setPullRequestMode({ sessionId, mode: 'overview' }),
    [sessionId, setPullRequestMode],
  );

  useEffect(() => {
    const onRequest = (event: Event): void => {
      if (!isReviewRequest(event) || event.defaultPrevented) {
        return;
      }
      if (event.detail.sessionId !== sessionId || event.detail.request.kind !== 'push') {
        return;
      }
      event.preventDefault();
      if (!isPushBusy) {
        void push.arm({
          isRetry: selectedPushIds === undefined && hasPushFailure,
          threadIds: selectedPushIds,
        });
      }
    };
    window.addEventListener(REVIEW_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(REVIEW_REQUEST_EVENT, onRequest);
  }, [hasPushFailure, isPushBusy, push, selectedPushIds, sessionId]);

  const pullRequestView = usePullRequestView({
    sessionId,
    isEnabled: pr !== null,
    fallbackNumber: pr?.number ?? null,
  });
  const reloadPullRequestView = pullRequestView.reload;

  const onMutated = useCallback(() => {
    void refreshActiveRequest({ get: useAppStore.getState, sessionId });
    if (host === 'github') {
      void refreshSessionPrDetail(sessionId, { force: true });
    }
    reloadPullRequestView();
  }, [host, refreshSessionPrDetail, reloadPullRequestView, sessionId]);

  const onPullRequestCreated = useCallback(() => {
    setPullRequestMode({ sessionId, mode: 'overview' });
    onMutated();
  }, [onMutated, sessionId, setPullRequestMode]);

  const selectTab = useCallback(
    (next: BranchTab): void => {
      if (next === tab) {
        return;
      }
      navigate({
        to: branchPlace({ sessionId, mountPath: identity.mountPath, tab: next }),
        mode: 'replace',
      });
    },
    [identity.mountPath, navigate, sessionId, tab],
  );

  const capabilities = activeSource?.capabilities ?? REVIEW_SOURCE_CAPABILITIES[host];
  const hasEditAction = controls.pullRequestControls.actions.some(
    (action) => action.id === 'pullRequest.editDetails',
  );
  const hasRequestAction = controls.pullRequestControls.actions.some(
    (action) => action.id === 'pullRequest.requestReview',
  );
  const canEditTitle = hasEditAction && capabilities.canEditTitle;
  const canEditBody = hasEditAction && capabilities.canEditBody;
  const requestReason = capabilityReasonOf({ kind: host, capability: 'canRequestReviewers' });
  const request: ReviewerRequest = !hasRequestAction
    ? { kind: 'hidden' }
    : requestReason === null
      ? { kind: 'allowed' }
      : { kind: 'disabled', reason: requestReason };
  const behind =
    diff.status === null ? null : distanceBehind({ distance: diff.status.mainDistance });
  const rebaseAction = controls.diffControls.actions.find((action) => action.id === 'diff.rebase');
  const onRebase =
    rebaseAction === undefined || rebaseAction.blockedReason !== null
      ? null
      : () => controls.diffControls.trigger({ actionId: rebaseAction.id });
  const onOpenFiles = (path: string | null): void => {
    if (path === null) {
      selectTab('files');
      return;
    }
    openDiffLens(sessionId, { kind: 'branch', path });
  };

  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;
  const hasRemote = sources.length > 0;
  const filesCount = diff.loading || diff.error !== null ? null : diff.files.length;
  const commentsCount = activeSource !== null && !activeSource.hasDetail ? null : entries.length;

  const body = () => {
    if ((tab === 'pr' || tab === 'comments') && !hasRemote && repo === null) {
      return (
        <NoPullRequest
          session={session}
          mountPath={identity.mountPath}
          isRepoMissing
          isConnected={isGithubConnected}
          onConnected={() => void githubConnection.refresh()}
          onCreated={onPullRequestCreated}
        />
      );
    }
    if (tab === 'pr') {
      return (
        <PageColumn width="column" className="flex min-w-0 flex-col">
          <PullRequestTab
            session={session}
            host={host}
            pr={pr}
            isBitbucketRemote={bitbucketRemote.isBitbucket}
            newPullRequestUrl={bitbucketRemote.newPullRequestUrl}
            detail={github?.detail ?? null}
            view={pullRequestView.view}
            edits={pullRequestView.edits}
            viewError={pullRequestView.error}
            viewErrorKind={pullRequestView.errorKind}
            mountPath={identity.mountPath}
            canEdit={canEditBody}
            request={request}
            behind={behind}
            distanceBase={identity.mount?.baseBranch ?? null}
            isConnected={isGithubConnected}
            onRebase={onRebase}
            onMutated={onMutated}
            onCreated={onPullRequestCreated}
            onConnected={() => void githubConnection.refresh()}
            onReload={reloadPullRequestView}
            onSelectTab={selectTab}
            onOpenFiles={onOpenFiles}
          />
        </PageColumn>
      );
    }
    if (tab === 'files') {
      return (
        <BranchFiles
          session={session}
          workingDir={workingDir}
          worktreePath={identity.mountPath}
          diff={diff}
          hasPullRequest={pr !== null && pr.state === 'open'}
        />
      );
    }
    if (tab === 'commits') {
      return <BranchCommits sessionId={sessionId} worktreePath={identity.mountPath} />;
    }
    if (tab === 'checks') {
      return <BranchChecks sessionId={sessionId} />;
    }
    return (
      <>
        <ReviewFlow session={session} push={push} />
      </>
    );
  };

  const baseRow =
    controls.isChangingBase && controls.projectId !== null ? (
      <DiffBaseBranchRow
        projectId={controls.projectId}
        repoPath={controls.projectRoot}
        value={controls.projectBaseBranch}
        onDone={controls.closeChangingBase}
      />
    ) : null;

  return (
    <BranchDiffContext.Provider value={identity.mountPath === null ? null : diff}>
      <TabActionsSlotContext.Provider value={tabActionsSlot}>
        <DiffRailScope isActive={tab === 'files'}>
          <PaneShell
            width="column"
            scroll="self"
            header={
              <div className="flex min-w-0 flex-col gap-3">
                <BranchHeader
                  sessionId={sessionId}
                  host={host}
                  mountPath={identity.mountPath}
                  pr={pr}
                  detail={github?.detail ?? null}
                  projectName={projectName}
                  branch={identity.mount?.branch ?? null}
                  baseBranch={identity.mount?.baseBranch ?? null}
                  fallbackTitle={identity.label}
                  controls={controls}
                  isPushBusy={isPushBusy}
                  tab={tab}
                  isActive={isActive}
                  canEditTitle={canEditTitle}
                  createdAt={pullRequestView.view?.createdAt ?? null}
                  onMutated={onMutated}
                />
                <PushBanner sessionId={sessionId} push={push} />
                {baseRow}
                {controls.rebaseError !== null && (
                  <p role="alert" className="text-meta text-danger" title={controls.rebaseError}>
                    {controls.rebaseError}
                  </p>
                )}
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <SegmentedTabs<BranchTab>
                    ariaLabel="Branch"
                    size="sm"
                    className="w-fit"
                    value={tab}
                    onChange={selectTab}
                    options={tabs.map(({ id: value, label }) => ({
                      value,
                      label: value === 'pr' ? tabLabelOf({ host, label }) : label,
                      badge:
                        value === 'comments' ? (
                          <TabCount count={commentsCount} />
                        ) : value === 'files' ? (
                          <TabCount count={filesCount} />
                        ) : value === 'commits' ? (
                          <TabCount count={commitCount} />
                        ) : undefined,
                    }))}
                  />
                  <div
                    ref={setTabActionsSlot}
                    data-slot="branch-tab-actions"
                    className="flex shrink-0 items-center gap-2"
                  />
                </div>
              </div>
            }
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-3">{body()}</div>
          </PaneShell>
        </DiffRailScope>
      </TabActionsSlotContext.Provider>
    </BranchDiffContext.Provider>
  );
};
