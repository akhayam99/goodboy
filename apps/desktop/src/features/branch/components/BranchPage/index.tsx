import { useCallback, useEffect, useMemo, useState } from 'react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core/review-source';
import { PageColumn, PaneShell } from '@goodboy/ui';
import type { PullRequestHost, Session, SessionId } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../store';
import { branchGithubOf } from '../../../../store/slices/github/branchGithubOf';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { pullRequestViewOf } from '../../../../store/slices/pull-request-view/pullRequestViewOf';
import { refreshActiveRequest } from '../../../../store/slices/review-source/refreshActiveRequest';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { DiffRailContext, type DiffRailHost } from '../../../diff/diffRailHost';
import { JobBanner } from '../../../history/JobBanner';
import { DiffBaseBranchRow } from '../../../diff/components/SessionDiffPane/DiffBaseBranchRow';
import { useSessionDiff } from '../../../diff/hooks/useSessionDiff';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import { PushBanner } from '../../../resolve/components/ReviewFlow/PushBanner';
import { ReviewFlowVisit } from '../../../resolve/components/ReviewFlow/ReviewFlowVisit';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { useReviewPush } from '../../../resolve/components/ReviewFlow/useReviewPush';
import { useActiveReviewSource } from '../../../resolve/hooks/useActiveReviewSource';
import { REVIEW_REQUEST_EVENT, isReviewRequest } from '../../../review/reviewRequest';
import { BranchDiffContext } from '../../branchDiffContext';
import { useBranchControls } from '../../hooks/useBranchControls';
import { useBitbucketRemote } from '../../hooks/useBitbucketRemote';
import { useBranchIdentity } from '../../hooks/useBranchIdentity';
import { useBranchStart } from '../../hooks/useBranchStart';
import { usePullRequestReadiness } from '../../hooks/usePullRequestReadiness';
import { pullRequestNextStepOf } from '../../pullRequestNextStepOf';
import { hasOpenRebaseStopOf } from '../../hasOpenRebaseStopOf';
import { MERGE_METHOD_LABEL } from '../../../actions/kinds/pullRequest';
import { useBranchTab } from '../../hooks/useBranchTab';
import { usePullRequestView } from '../../hooks/usePullRequestView';
import { capabilityReasonOf } from '../../pullRequestCapabilityReason';
import { useBranchReviewState } from '../../hooks/useBranchReviewState';
import { branchTabsOf, isBranchReadOnly, resolveBranchTab } from '../../branchTabs';
import { branchScopeOf } from '../../../../store/slices/session-view/branchScopeOf';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import { pullRequestRunsOf } from '../../pullRequestRunsOf';
import { reviewCounts } from '../../../resolve/reviewCounts';
import { requestNounLabel } from '../../requestNounLabel';
import { worktreeEntryFactsOf } from '../../worktreeEntryFacts';
import { BranchChecks } from '../BranchChecks';
import { BranchCommits } from '../BranchCommits';
import { BranchFiles } from '../BranchFiles';
import { BranchHeader } from '../BranchHeader';
import { BranchStartLine } from '../BranchStartLine';
import { BranchTabStrip } from '../BranchTabStrip';
import { NoPullRequest } from '../PullRequestTab/NoPullRequest';
import { PullRequestTab } from '../PullRequestTab';
import { PullRequestHeaderLine } from '../PullRequestTab/PullRequestHeaderLine';
import type { ReviewerRequest } from '../PullRequestTab/ReviewersProperty';
import { BranchDetail } from './BranchDetail';
import { BranchScroll } from './BranchScroll';
import { TabActionsSlotContext } from '../../../../shared/components/TabActions/tabActionsSlotContext';

const NO_PREFILL = { title: '', body: '' };

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
  const diffFocus = useAppStore((s) => s.diffFocus[sessionId] ?? null);
  const historyMountId = identity.mount?.mountId ?? null;
  const github = useAppStore((s) =>
    branchGithubOf({ state: s, sessionId, mountId: historyMountId }),
  );
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const [tabActionsSlot, setTabActionsSlot] = useState<HTMLElement | null>(null);
  const [page, setPage] = useState<HTMLElement | null>(null);
  const [fileSlot, setFileSlot] = useState<HTMLElement | null>(null);
  const historyCommits = useAppStore((s) =>
    historyMountId === null ? null : (s.historyDrafts[historyMountId]?.commits ?? null),
  );
  const hasRemoteHead = useAppStore(
    (s) => historyMountId !== null && s.historyDrafts[historyMountId]?.graph?.remoteSha != null,
  );
  const hasHistoryDraft = useAppStore(
    (s) => historyMountId !== null && s.historyDrafts[historyMountId] !== undefined,
  );
  const loadHistoryDraft = useAppStore((s) => s.loadHistoryDraft);
  const historyRevision = useAppStore((s) =>
    historyMountId === null
      ? ''
      : `${s.historyDrafts[historyMountId]?.headSha ?? ''}:${s.historyRuns[historyMountId]?.updatedAt ?? 0}`,
  );
  const repo = useSessionRepo({ sessionId, mountId: historyMountId });
  const bitbucketRemote = useBitbucketRemote({
    sessionId,
    workspaceId: session.workspaceId,
    mountId: historyMountId,
    repoRoot: repo?.repoRoot ?? null,
  });
  const githubConnection = useGithubConnection({ workspaceId: session.workspaceId });
  const { entries: sources, source: activeSource } = useActiveReviewSource({
    sessionId,
    mountId: historyMountId,
  });
  const { entries } = useReviewEntries({ sessionId, mountId: historyMountId });
  const push = useReviewPush({ sessionId, mountId: historyMountId });
  const diff = useSessionDiff({
    sessionId,
    worktreePath: identity.mountPath,
    diffFocus,
    branchRevision: historyRevision,
  });

  const { pr } = identity;
  const mountDiffStats = useMountDiffStats(sessionId);
  const remoteKind = useMountRemoteHostKind({
    sessionId,
    repoRoot: identity.mount?.repoRoot ?? null,
  });
  const remoteHost: PullRequestHost =
    remoteKind === 'gitlab' ? 'gitlab' : bitbucketRemote.isBitbucket ? 'bitbucket' : 'github';
  const host: PullRequestHost = pr === null ? remoteHost : identity.host;
  const hasComments = useAppStore(
    (s) => branchScopeOf({ state: s, sessionId, mountId: historyMountId }).hasComments,
  );
  const scope = {
    state:
      pr === null ? ('none' as const) : pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft }),
    hasComments,
  };
  const requestLabel = requestNounLabel({ host });
  const tabs = branchTabsOf(scope).map((entry) =>
    entry.id === 'pr' ? { ...entry, label: requestLabel } : entry,
  );
  const tab = resolveBranchTab({ tab: storedTab, scope });
  const isReadOnly = isBranchReadOnly(scope);
  const { hasPushFailure, isPushBusy, pushCount, review } = useBranchReviewState({
    entries,
    phaseKind: push.phase.kind,
    status: diff.status,
    commits: historyCommits,
    hasRemoteHead,
  });

  const start = useBranchStart({
    sessionId,
    mountId: historyMountId,
    mountPath: identity.mountPath,
    status: diff.status,
  });
  const isBranchStart = pr === null;
  const hasOpenRebaseStop = useAppStore((s) =>
    hasOpenRebaseStopOf({ state: s, sessionId, mountId: historyMountId, status: diff.status }),
  );
  const prReadiness = usePullRequestReadiness({
    sessionId,
    mountId: historyMountId,
    isRebaseStopOpen: hasOpenRebaseStop,
    unpushed: start.step.unpushed,
  });
  const mergeMethod = useAppStore(
    (s) =>
      pullRequestViewOf({
        state: s,
        sessionId,
        mountId: historyMountId,
        prNumber: pr?.number ?? null,
      })?.view?.mergeMethods[0],
  );
  const mergeWord = MERGE_METHOD_LABEL[mergeMethod ?? 'squash'];
  const onlineAhead = start.step.originOnly ?? 0;
  const branchFacts = useMemo(
    () => ({
      ahead: start.step.ahead ?? 0,
      behind: start.step.behind,
      onlineAhead,
      isRebasing: start.step.state === 'conflict',
    }),
    [onlineAhead, start.step.ahead, start.step.behind, start.step.state],
  );
  const nextStep = isBranchStart
    ? start.step.header
    : pr === null
      ? null
      : pullRequestNextStepOf({
          state: scope.state,
          facts: prReadiness.facts,
          readiness: prReadiness.readiness,
          hasReviewer: prReadiness.reviewers.people.length > 0,
          behind: start.step.behind ?? 0,
          isStopOpen: hasOpenRebaseStop,
        });

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

  const controls = useBranchControls({
    sessionId,
    worktreePath: identity.mountPath,
    pr,
    diff,
    review,
    remoteHost: host,
    nextStep,
    hasOpenRebaseStop,
    mergeLabel: mergeWord,
    onOpenTab: selectTab,
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
      void push.press({ isRetry: hasPushFailure });
    };
    window.addEventListener(REVIEW_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(REVIEW_REQUEST_EVENT, onRequest);
  }, [hasPushFailure, push, sessionId]);

  const pullRequestView = usePullRequestView({
    sessionId,
    mountId: historyMountId,
    isEnabled: pr !== null,
    fallbackNumber: pr?.number ?? null,
  });
  const reloadPullRequestView = pullRequestView.reload;

  const onMutated = useCallback(() => {
    void refreshActiveRequest({ get: useAppStore.getState, sessionId });
    if (host === 'github') {
      void refreshSessionPrDetail(sessionId, {
        force: true,
        ...(historyMountId === null ? {} : { mountId: historyMountId }),
      });
    }
    reloadPullRequestView();
  }, [historyMountId, host, refreshSessionPrDetail, reloadPullRequestView, sessionId]);

  const onPullRequestCreated = useCallback(() => {
    setPullRequestMode({ sessionId, mode: 'overview' });
    onMutated();
  }, [onMutated, sessionId, setPullRequestMode]);

  const isGithubConnected = !githubConnection.isResolved || githubConnection.isAuthenticated;
  const capabilities = activeSource?.capabilities ?? REVIEW_SOURCE_CAPABILITIES[host];
  const isFormLeading =
    isBranchStart &&
    tab === 'pr' &&
    start.step.state === 'unpushed' &&
    !bitbucketRemote.isBitbucket &&
    (sources.length > 0 || repo !== null);
  const isPrimaryYielding =
    isFormLeading ||
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
  const filesCount = diff.loading || diff.error !== null ? null : diff.files.length;

  const body = () => {
    if ((tab === 'pr' || tab === 'comments') && sources.length === 0 && repo === null) {
      return (
        <NoPullRequest
          session={session}
          mountPath={identity.mountPath}
          prefill={NO_PREFILL}
          isRepoMissing
          isConnected={isGithubConnected}
          onConnected={() => void githubConnection.refresh()}
          onCreated={onPullRequestCreated}
        />
      );
    }
    if (tab === 'pr') {
      return (
        <BranchScroll sessionId={sessionId} tab={tab} view={pullRequestView.view}>
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
              branch={identity.mount?.branch ?? null}
              start={start}
              mountId={historyMountId}
              readiness={prReadiness}
              branchFacts={branchFacts}
              mergeWord={mergeWord}
              commits={diff.commits}
              canEdit={canEditBody}
              request={request}
              isConnected={isGithubConnected}
              onMutated={onMutated}
              onCreated={onPullRequestCreated}
              onConnected={() => void githubConnection.refresh()}
              onReload={reloadPullRequestView}
              onSelectTab={selectTab}
            />
          </PageColumn>
        </BranchScroll>
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
          isReadOnly={isReadOnly}
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
        <BranchScroll sessionId={sessionId} tab={tab} view={pullRequestView.view}>
          <BranchChecks sessionId={sessionId} mountId={historyMountId} />
        </BranchScroll>
      );
    }
    const visit = {
      mountId: historyMountId,
      push,
      pushCount: push.phase.kind === 'idle' ? pushCount : 0,
      isPushInHeader: controls.secondary?.label.startsWith('Push ') === true,
      isVisible: isActive,
      onRequestReview:
        request.kind === 'allowed'
          ? () => controls.pullRequestControls.trigger({ actionId: 'pullRequest.requestReview' })
          : null,
    };
    return <ReviewFlowVisit session={session} {...visit} />;
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
  const checksRuns = pullRequestRunsOf({
    pr,
    detail: github?.detail ?? null,
    view: pullRequestView.view,
  });
  const checksUnreadReason =
    pr === null
      ? null
      : pr.checksUnknown === true || matchedDetail?.checksRead === 'denied'
        ? 'Checks unknown: this token cannot read them'
        : matchedDetail?.checksRead === 'failed'
          ? "Checks unknown: couldn't read them"
          : null;
  const mountStat = mountDiffStats.get(identity.mountPath ?? '') ?? null;
  const entryFacts = worktreeEntryFactsOf({
    pullRequestState: scope.state,
    commentsNeedYou: reviewCounts({ threads: entries.map((e) => e.row.thread) }).needYou,
    files: mountStat?.files ?? filesCount,
    diff: mountStat,
    commits: start.step.ahead,
    notPushed: pushCount,
    checks: checksRuns,
    checksUnreadReason,
  });
  const railSlot = useMemo<DiffRailHost>(() => ({ slot: fileSlot, page }), [fileSlot, page]);

  const tabActionsSlotNode = (
    <div
      ref={setTabActionsSlot}
      data-slot="branch-tab-actions"
      className="flex min-w-0 shrink-0 items-center justify-end gap-2 empty:hidden"
    />
  );

  const startLine = isBranchStart ? <BranchStartLine start={start} /> : null;

  const detail = (
    <BranchDetail>
      <PaneShell
        page="branch"
        scroll="self"
        header={
          <div className="flex min-w-0 flex-col gap-3">
            <BranchHeader
              sessionId={sessionId}
              host={host}
              pr={pr}
              fallbackTitle={identity.label}
              line={
                startLine ??
                (pr === null ? null : (
                  <PullRequestHeaderLine
                    pr={pr}
                    host={host}
                    view={pullRequestView.view}
                    readiness={prReadiness}
                    isThreadsShown={tab === 'comments'}
                  />
                ))
              }
              controls={controls}
              isPushBusy={isPushBusy}
              isPrimaryYielding={isPrimaryYielding}
              tab={tab}
              isActive={isActive}
              canEditTitle={canEditTitle}
              pageAction={tab === 'comments' ? tabActionsSlotNode : null}
              onMutated={onMutated}
            />
            <BranchTabStrip tabs={tabs} facts={entryFacts} value={tab} onSelect={selectTab} />
            <PushBanner sessionId={sessionId} mountId={historyMountId} push={push} />
            {baseRow}
            <div data-rebase-flow-hook="" className="flex min-w-0 flex-col empty:hidden">
              <JobBanner sessionId={sessionId} worktreePath={identity.mountPath} />
            </div>
            {tab === 'comments' ? null : tabActionsSlotNode}
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
            ref={setPage}
            data-branch-pane=""
            className="relative flex h-full min-h-0 min-w-0 flex-1"
          >
            {detail}
            {tab === 'files' ? (
              <div
                ref={setFileSlot}
                data-slot="diff-file-rail"
                className="flex h-full min-h-0 shrink-0 empty:hidden"
              />
            ) : null}
          </div>
        </DiffRailContext.Provider>
      </TabActionsSlotContext.Provider>
    </BranchDiffContext.Provider>
  );
};
