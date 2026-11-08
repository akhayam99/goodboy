import { useCallback, useEffect, useMemo, useState } from 'react';
import { REVIEW_SOURCE_CAPABILITIES } from '@goodboy/core/review-source';
import { PageColumn, PaneShell } from '@goodboy/ui';
import type { PullRequestHost, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchGithubOf } from '../../../../store/slices/github/branchGithubOf';
import { branchPlace } from '../../../../store/slices/navigation/place';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { pullRequestViewOf } from '../../../../store/slices/pull-request-view/pullRequestViewOf';
import { refreshActiveRequest } from '../../../../store/slices/review-source/refreshActiveRequest';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { DiffRailContext, type DiffRailHost } from '../../../diff/diffRailHost';
import { DiffBaseBranchRow } from '../../../diff/components/SessionDiffPane/DiffBaseBranchRow';
import { useSessionDiff } from '../../../diff/hooks/useSessionDiff';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { useMountRemoteHostKind } from '../../../worktree/useMountRemoteHostKind';
import { BranchLead } from './BranchLead';
import { ReviewFlowVisit } from '../../../resolve/components/ReviewFlow/ReviewFlowVisit';
import { useActiveReviewSource } from '../../../resolve/hooks/useActiveReviewSource';
import { useBranchReview } from '../../../resolve/hooks/useBranchReview';
import { usePushRequest } from '../../hooks/usePushRequest';
import { BranchDiffContext } from '../../branchDiffContext';
import { useBranchControls } from '../../hooks/useBranchControls';
import { useBitbucketRemote } from '../../hooks/useBitbucketRemote';
import { useBranchIdentity } from '../../hooks/useBranchIdentity';
import { useBranchStart } from '../../hooks/useBranchStart';
import { usePullRequestReadiness } from '../../hooks/usePullRequestReadiness';
import { pullRequestNextStepOf } from '../../pullRequestNextStepOf';
import { pushPhaseYieldsOf } from '../../pushPhaseYieldsOf';
import { hasOpenRebaseStopOf } from '../../hasOpenRebaseStopOf';
import { MERGE_METHOD_LABEL } from '../../../actions/kinds/pullRequest';
import { useBranchTab } from '../../hooks/useBranchTab';
import { useBranchTabFacts } from '../../hooks/useBranchTabFacts';
import { usePullRequestView } from '../../hooks/usePullRequestView';
import { capabilityReasonOf } from '../../pullRequestCapabilityReason';
import { useBranchReviewState } from '../../hooks/useBranchReviewState';
import { branchTabsOf, isBranchReadOnly, resolveBranchTab } from '../../branchTabs';
import { branchScopeOf } from '../../../../store/slices/session-view/branchScopeOf';
import { pullRequestKindOf } from '../../../../shared/utils/pullRequestKind';
import { requestNounLabel } from '../../requestNounLabel';
import { loadedBranchFilesOf } from '../../loadedBranchFilesOf';
import { BranchChecks } from '../BranchChecks';
import { BranchCommits } from '../BranchCommits';
import { BranchFiles } from '../BranchFiles';
import { BranchHeader } from '../BranchHeader';
import { BranchRunningLine } from '../BranchRunningLine';
import { BranchStartLine } from '../BranchStartLine';
import { BranchTabStrip } from '../BranchTabStrip';
import { BranchWorkLines } from '../BranchWorkLines';
import { NoPullRequest } from '../PullRequestTab/NoPullRequest';
import { PullRequestTab } from '../PullRequestTab';
import { PullRequestHeaderLine } from '../PullRequestTab/PullRequestHeaderLine';
import type { ReviewerRequest } from '../PullRequestTab/ReviewersProperty';
import { BranchDetail } from './BranchDetail';
import { BranchScroll } from './BranchScroll';
import { BranchWorkBody } from './BranchWorkBody';
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
  const storedTab = useBranchTab({ sessionId });
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
  const sources = useActiveReviewSource({ sessionId, mountId: historyMountId });
  const branchReview = useBranchReview({ sessionId, mountId: historyMountId });
  const diff = useSessionDiff({
    sessionId,
    worktreePath: identity.mountPath,
    diffFocus,
    branchRevision: historyRevision,
  });

  const { pr } = identity;
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
    entries: branchReview.entries,
    phaseKind: branchReview.push.phase.kind,
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
    comments: branchReview.comments,
    facts: prReadiness.facts,
    hasOpenRebaseStop,
    mergeLabel: mergeWord,
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

  usePushRequest({ sessionId, push: branchReview.push, hasPushFailure });

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
  const capabilities = sources.source?.capabilities ?? REVIEW_SOURCE_CAPABILITIES[host];
  const isFormLeading =
    isBranchStart &&
    tab === 'pr' &&
    start.step.state === 'unpushed' &&
    !bitbucketRemote.isBitbucket &&
    (sources.entries.length > 0 || repo !== null);
  const isPrimaryYielding =
    isFormLeading ||
    pushPhaseYieldsOf({ kind: branchReview.push.phase.kind }) ||
    (tab === 'comments' && branchReview.isSelecting);

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

  const body = () => {
    if ((tab === 'pr' || tab === 'comments') && sources.entries.length === 0 && repo === null) {
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
        <BranchScroll key={tab} sessionId={sessionId} tab={tab} view={pullRequestView.view}>
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
              entries={branchReview.branchEntries}
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
          commitTotal={entryFacts.commits.count}
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
    if (tab === 'work') {
      return <BranchWorkBody session={session} work={work} />;
    }
    if (tab === 'checks') {
      return (
        <BranchScroll key={tab} sessionId={sessionId} tab={tab} view={pullRequestView.view}>
          <BranchChecks sessionId={sessionId} mountId={historyMountId} />
        </BranchScroll>
      );
    }
    const visit = {
      mountId: historyMountId,
      push: branchReview.push,
      isVisible: isActive,
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

  const { facts: entryFacts, work } = useBranchTabFacts({
    session,
    identity,
    state: scope.state,
    detail: github?.detail ?? null,
    view: pullRequestView.view,
    entries: branchReview.branchEntries,
    loadedFiles: loadedBranchFilesOf({ diff: { ...diff, isLoading: diff.loading } }),
    ahead: start.step.ahead,
    notPushed: pushCount,
  });
  const railSlot = useMemo<DiffRailHost>(() => ({ slot: fileSlot, page }), [fileSlot, page]);

  const detail = (
    <BranchDetail>
      <PaneShell
        page="branch"
        scroll="self"
        revealKey={tab}
        headerRhythm="section"
        lead={
          <BranchLead
            sessionId={sessionId}
            mountId={historyMountId}
            worktreePath={identity.mountPath}
            push={branchReview.push}
          />
        }
        header={
          <div className="flex min-w-0 flex-col gap-3">
            <BranchHeader
              sessionId={sessionId}
              host={host}
              pr={pr}
              fallbackTitle={identity.label}
              line={
                isBranchStart ? (
                  <BranchStartLine start={start} />
                ) : pr === null ? null : (
                  <PullRequestHeaderLine pr={pr} host={host} />
                )
              }
              controls={controls}
              isPushBusy={isPushBusy}
              isPrimaryYielding={isPrimaryYielding}
              isStepHidden={isFormLeading && controls.step === 'push'}
              tab={tab}
              isActive={isActive}
              canEditTitle={canEditTitle}
              onMutated={onMutated}
            />
            <BranchRunningLine session={session} mount={identity.mount} isActive={isActive} />
            <BranchTabStrip tabs={tabs} facts={entryFacts} value={tab} onSelect={selectTab} />
            <BranchWorkLines
              session={session}
              checkWork={controls.checkWork}
              run={branchReview.run}
              lane={branchReview.lane}
              isFixRunShown={tab !== 'comments' && branchReview.comments.facts.isFixRunLive}
              onOpenComments={() => selectTab('comments')}
            />
            {baseRow}
            <div
              ref={setTabActionsSlot}
              data-slot="branch-tab-actions"
              className="flex min-w-0 shrink-0 items-center justify-end gap-2 empty:hidden"
            />
          </div>
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{body()}</div>
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
