import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core';
import { ICON_SIZE, PageColumn, PaneShell, ScrollFade, tintClasses } from '@goodboy/ui';
import type { PullRequestHost, Session, SessionId } from '@goodboy/types';
import { useAppStore, useMountDiffStats } from '../../../../store';
import { branchPushFactsOf } from '../../../../shared/lib/branchPushState';
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
import { ReviewFlow } from '../../../resolve/components/ReviewFlow';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { useReviewPush } from '../../../resolve/components/ReviewFlow/useReviewPush';
import { pushFixCount } from '../../../resolve/reviewPushCopy';
import { useActiveReviewSource } from '../../../resolve/hooks/useActiveReviewSource';
import { isPushFailure } from '../../../resolve/reviewCommentState';
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
import type { BranchPushState, BranchReviewCounts } from '../../branchPrimary';
import { branchTabsOf, isBranchReadOnly, resolveBranchTab } from '../../branchTabs';
import { branchScopeOf } from '../../../../store/slices/session-view/branchScopeOf';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import { pullRequestRunsOf } from '../../pullRequestRunsOf';
import { commentsCountOf } from '../../../resolve/commentsCountOf';
import { requestNounLabel } from '../../requestNounLabel';
import { worktreeEntryFactsOf } from '../../worktreeEntryFacts';
import { worktreeEntryFactsBus } from '../../worktreeEntryFactsBus';
import { BranchChecks } from '../BranchChecks';
import { BranchCommits } from '../BranchCommits';
import { BranchFiles } from '../BranchFiles';
import { BranchHeader } from '../BranchHeader';
import { NoPullRequest } from '../PullRequestTab/NoPullRequest';
import { PullRequestTab } from '../PullRequestTab';
import { PullRequestHeaderLine } from '../PullRequestTab/PullRequestHeaderLine';
import type { ReviewerRequest } from '../PullRequestTab/ReviewersProperty';
import { BranchDetail } from './BranchDetail';
import { TabActionsSlotContext } from '../../../../shared/components/TabActions/tabActionsSlotContext';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

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
  const pushState: BranchPushState =
    push.phase.kind === 'confirm' || push.phase.kind === 'sync_confirm'
      ? 'open'
      : isPushBusy
        ? 'busy'
        : 'idle';
  const pushingCount =
    push.phase.kind === 'pushing' ? pushFixCount({ preview: push.phase.preview }) : 0;
  const pushCount = pushingCount > 0 ? pushingCount : pushableIds.length;

  const review = useMemo<BranchReviewCounts>(
    () => ({
      accepted: pushableIds.length,
      replies: entries.filter((entry) => entry.remote === 'on_origin').length,
      failed: entries.filter(
        (entry) => entry.state === 'failed' && isPushFailure({ row: entry.row }),
      ).length,
      isPushing: entries.some((entry) => entry.row.thread.stage === 'publishing'),
      push: { state: pushState, count: pushCount },
    }),
    [entries, pushCount, pushState, pushableIds],
  );

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
  const onlineAhead =
    diff.status !== null && diff.status.upstreamDistance.kind === 'known'
      ? diff.status.upstreamDistance.behind
      : 0;
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
  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;
  const hasRemote = sources.length > 0;
  const filesCount = diff.loading || diff.error !== null ? null : diff.files.length;

  const body = () => {
    if ((tab === 'pr' || tab === 'comments') && !hasRemote && repo === null) {
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
              branch={identity.mount?.branch ?? null}
              start={start}
              mountId={historyMountId}
              readiness={prReadiness}
              branchFacts={branchFacts}
              mergeWord={mergeWord}
              commits={diff.commits}
              diffRevision={historyRevision}
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
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <BranchChecks sessionId={sessionId} mountId={historyMountId} />
        </ScrollFade>
      );
    }
    return <ReviewFlow session={session} mountId={historyMountId} push={push} />;
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
  const entryFacts = worktreeEntryFactsOf({
    pullRequestState: scope.state,
    commentsNeedYou: commentsCountOf({ threads: entries.map((entry) => entry.row.thread) })
      .needsYou,
    files: filesCount,
    diff: identity.mountPath === null ? null : (mountDiffStats.get(identity.mountPath) ?? null),
    notPushed: branchPushFactsOf({ status: diff.status, commits: historyCommits, hasRemoteHead })
      .toPush,
    checks: checksRuns,
    checksUnreadReason,
  });
  const factsKey = JSON.stringify(entryFacts);
  const latestFacts = useRef(entryFacts);
  latestFacts.current = entryFacts;
  useEffect(() => {
    if (!isActive) {
      return;
    }
    worktreeEntryFactsBus.publish({ sessionId, facts: latestFacts.current });
  }, [factsKey, isActive, sessionId]);
  useEffect(() => () => worktreeEntryFactsBus.clear({ sessionId }), [sessionId]);
  const railSlot = useMemo<DiffRailHost>(() => ({ slot: fileSlot, page }), [fileSlot, page]);

  const tabActionsSlotNode = (
    <div
      ref={setTabActionsSlot}
      data-slot="branch-tab-actions"
      className="flex min-w-0 shrink-0 items-center justify-end gap-2 empty:hidden"
    />
  );

  const startLine = isBranchStart ? (
    <span
      data-branch-start-line={start.step.state}
      className="flex min-w-0 flex-wrap items-center gap-x-2 text-meta text-muted-foreground"
    >
      <span className={`inline-flex items-center gap-1 ${tintClasses(start.line.tone).text}`}>
        <CONCEPT_ICONS.branch size={ICON_SIZE.row} aria-hidden />
        {start.line.word}
      </span>
      {start.line.distance === null ? null : <span>{start.line.distance}</span>}
    </span>
  ) : null;

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
              fallbackTitle={
                tab === 'pr'
                  ? identity.label
                  : (tabs.find((entry) => entry.id === tab)?.label ?? identity.label)
              }
              line={
                startLine ??
                (pr === null ? null : (
                  <PullRequestHeaderLine
                    pr={pr}
                    host={host}
                    commitCount={
                      pullRequestView.view?.number === pr.number
                        ? pullRequestView.view.commits.length
                        : null
                    }
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
