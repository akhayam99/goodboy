import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import { Button, Eyebrow, PageColumn, PaneShell, ScrollFade, StudioRailLayout } from '@goodboy/ui';
import type { PullRequestHost, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { refreshActiveRequest } from '../../../../store/slices/review-source/refreshActiveRequest';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { DiffRailContext, type DiffRailHost } from '../../../diff/diffRailHost';
import { JobBanner } from '../../../history/JobBanner';
import { DiffBaseBranchRow } from '../../../diff/components/SessionDiffPane/DiffBaseBranchRow';
import { useSessionDiff } from '../../../diff/hooks/useSessionDiff';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import { PushBanner } from '../../../resolve/components/ReviewFlow/PushBanner';
import { ReviewFlow } from '../../../resolve/components/ReviewFlow';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { useBranchNotes } from '../../../resolve/notes/useBranchNotes';
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
import { branchTabsOf, isBranchReadOnly, resolveBranchTab } from '../../branchTabs';
import { branchScopeOf } from '../../../../store/slices/session-view/branchTabOf';
import { pullRequestKindOf } from '../../../../shared/pullRequestKind';
import { BRANCH_RAIL_SURFACE } from '../../branchRailSurface';
import { useBranchRailDock } from '../../hooks/useBranchRailDock';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BranchRail } from '../BranchRail';
import { checksSummaryOf } from '../../checksSummary';
import { BranchRailOverlay } from '../BranchRail/BranchRailOverlay';
import { BranchChecks } from '../BranchChecks';
import { BranchCommits } from '../BranchCommits';
import { BranchFiles } from '../BranchFiles';
import { BranchHeader } from '../BranchHeader';
import { NoPullRequest } from '../PullRequestTab/NoPullRequest';
import { PullRequestTab } from '../PullRequestTab';
import type { ReviewerRequest } from '../PullRequestTab/ReviewersProperty';
import { BranchDetail } from './BranchDetail';
import { TabActionsSlotContext } from '../../../../shared/components/TabActions/tabActionsSlotContext';

type Props = {
  readonly session: Session;
  readonly workingDir: string | null;
  readonly isActive?: boolean;
};

export const BranchPage = ({ session, workingDir, isActive = true }: Props) => {
  const sessionId = session.id as SessionId;
  const identity = useBranchIdentity({ sessionId });
  const storedTab = useBranchTab({ sessionId, mountPath: identity.mountPath });
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const navigate = useAppStore((s) => s.navigate);
  const selectedThreadId = useAppStore((s) => s.branchThreadId[sessionId] ?? null);
  const diffFocus = useAppStore((s) => s.diffFocus[sessionId] ?? null);
  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const [tabActionsSlot, setTabActionsSlot] = useState<HTMLElement | null>(null);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);
  const dock = useBranchRailDock();
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
  const { all: notes } = useBranchNotes({ sessionId });
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
  const hasComments = useAppStore((s) => branchScopeOf({ state: s, sessionId }).hasComments);
  const scope = {
    state:
      pr === null ? ('none' as const) : pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft }),
    hasComments,
  };
  const tabs = branchTabsOf(scope);
  const tab = resolveBranchTab({ tab: storedTab, scope });
  const isReadOnly = isBranchReadOnly(scope);
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
  const isPrimaryYielding =
    push.phase.kind === 'confirm' ||
    push.phase.kind === 'pushing' ||
    push.phase.kind === 'sync_confirm' ||
    controls.diffControls.confirming !== null ||
    controls.pullRequestControls.confirming !== null;

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
  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;
  const hasRemote = sources.length > 0;
  const filesCount = diff.loading || diff.error !== null ? null : diff.files.length;
  const commentsCount =
    activeSource === null ? notes.length : activeSource.hasDetail ? entries.length : null;

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
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <PageColumn width="column" className="flex min-w-0 flex-col pb-5">
            <PullRequestTab
              session={session}
              host={host}
              pr={pr}
              isBitbucketRemote={bitbucketRemote.isBitbucket}
              isBitbucketConnected={bitbucketRemote.isConnected}
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
            />
          </PageColumn>
        </ScrollFade>
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
      return (
        <BranchCommits
          sessionId={sessionId}
          worktreePath={identity.mountPath}
          isReadOnly={isReadOnly}
        />
      );
    }
    if (tab === 'checks') {
      return (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <BranchChecks sessionId={sessionId} />
        </ScrollFade>
      );
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

  const matchedDetail =
    pr !== null && github?.detail?.prNumber === pr.number ? github.detail : null;
  const checksCount = matchedDetail === null ? null : matchedDetail.checks.length;
  const checksSummary =
    pr === null
      ? null
      : checksSummaryOf({ rollup: pr.checks, checks: matchedDetail?.checks ?? [] });
  const viewedCount =
    diff.loading || diff.error !== null
      ? null
      : diff.files.filter((file) => diff.viewed.stateOf(file) === 'viewed').length;
  const railNode = (
    <BranchRail
      tabs={tabs}
      current={tab}
      counts={{
        comments: commentsCount,
        files: filesCount,
        commits: commitCount,
        ...(checksCount !== null && { checks: checksCount }),
      }}
      hasFailingChecks={checksSummary?.tone === 'danger'}
      viewed={
        viewedCount === null || filesCount === null
          ? null
          : { viewed: viewedCount, total: filesCount }
      }
      hostRef={setRailHost}
      onSelect={(next) => {
        selectTab(next);
        dock.closeOverlay();
      }}
    />
  );
  const railSlot = useMemo<DiffRailHost>(
    () => ({
      host: tab === 'files' ? railHost : null,
      isOverlay: !dock.isDocked,
      open: dock.openOverlay,
      dismiss: dock.closeOverlay,
    }),
    [dock.closeOverlay, dock.isDocked, dock.openOverlay, railHost, tab],
  );

  const sectionsButton = dock.isDocked ? null : (
    <div className="flex h-10 shrink-0 items-start pl-2 pt-3">
      <Button
        size="xs"
        variant="ghost"
        aria-expanded={dock.isOverlayOpen}
        onClick={dock.openOverlay}
      >
        <PanelLeft size={ICON_SIZE.row} aria-hidden />
        Sections
      </Button>
    </div>
  );

  const detail = (
    <BranchDetail sectionsButton={sectionsButton} isInert={dock.isOverlayOpen}>
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
              projectName={projectName}
              branch={identity.mount?.branch ?? null}
              baseBranch={identity.mount?.baseBranch ?? null}
              fallbackTitle={identity.label}
              controls={controls}
              isPushBusy={isPushBusy}
              isPrimaryYielding={isPrimaryYielding}
              tab={tab}
              isActive={isActive}
              canEditTitle={canEditTitle}
              createdAt={pullRequestView.view?.createdAt ?? null}
              commitCount={commitCount}
              onMutated={onMutated}
            />
            <PushBanner sessionId={sessionId} push={push} />
            {baseRow}
            <JobBanner sessionId={sessionId} worktreePath={identity.mountPath} />
            <div
              ref={setTabActionsSlot}
              data-slot="branch-tab-actions"
              className="flex min-w-0 shrink-0 items-center justify-end gap-2 empty:hidden"
            />
          </div>
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-3">{body()}</div>
      </PaneShell>
    </BranchDetail>
  );

  return (
    <BranchDiffContext.Provider value={identity.mountPath === null ? null : diff}>
      <TabActionsSlotContext.Provider value={tabActionsSlot}>
        <DiffRailContext.Provider value={railSlot}>
          <div
            ref={dock.paneRef}
            data-branch-pane=""
            className="relative flex h-full min-h-0 min-w-0 flex-1"
          >
            <StudioRailLayout
              railLabel="Branch sections"
              railWidth="standard"
              surface={BRANCH_RAIL_SURFACE}
              placement="page"
              isCollapsed={!dock.isDocked}
              railHeader={
                <div className="flex h-6 min-w-0 flex-1 items-center px-2">
                  <Eyebrow label="Sections" muted />
                </div>
              }
              rail={dock.isDocked ? railNode : null}
              detail={detail}
            />
            {dock.isOverlayOpen ? (
              <BranchRailOverlay rail={railNode} onClose={dock.closeOverlay} />
            ) : null}
          </div>
        </DiffRailContext.Provider>
      </TabActionsSlotContext.Provider>
    </BranchDiffContext.Provider>
  );
};
