import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PrCheckRun,
  PrComment,
  PrReviewDraft,
  PullRequestState,
  Session,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useDiffComments, sessionPlace } from '../../../../store';
import { reviewThreadId } from '../../../../store/slices/review-navigation';
import { selectActiveProjectPrs } from '../../../../store/slices/github/activeProjectPrs';
import { selectPrWrite } from '../../../../store/slices/pr-writes/selectPrWrite';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { useToast } from '../../../../app/components/Toast';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { GithubConnectionEmptyState } from '../../../github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { usePrDraftAgentRunning } from '../../../github/usePrDraftAgentRunning';
import {
  prLifecycleFailureTitle,
  describePrWriteInFlight,
  type PrLifecycleBusy,
} from '../../prLifecycle';
import { evaluatePrMergeReadiness } from '../../prMergeReadiness';
import { buildCommentAgentArgs } from '../../../chat/spawn-from-comment';
import { kindRouting } from '../../../session/agent-kind';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import type { CommentThread } from '../../../github/comment-threads';
import type { ReviewMode } from '../../reviewMode';
import { PrActionsMenu } from './PrActionsMenu';
import { PrContextRow } from './PrContextRow';
import { PublishConversationsBar } from './PublishConversationsBar';
import { NoPullRequestState } from './ReviewEmptyStates';
import { openDiffComments } from '../../../session/resolve/openDiffComments';
import { ResolveQueueHome } from '../../../resolve/components/ResolveQueueHome';
import { ChecksMode } from './modes/ChecksMode';
import { CreatePrMode } from './modes/CreatePrMode';
import { PrActivityMode } from './modes/PrActivityMode';
import { PrDetailsMode } from './modes/PrDetailsMode';
import { WriteReview } from './WriteReview';
import { PublishBar } from './WriteReview/PublishBar';

type Props = {
  readonly session: Session;
};

const EMPTY_CHECKS: ReadonlyArray<PrCheckRun> = [];
const EMPTY_PRS: ReadonlyArray<PullRequestState> = [];
const REVIEW_TITLE = 'Review';

export const ReviewPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const mode = useAppStore((s) => s.reviewModes[sessionId] ?? 'queue');
  const setReviewMode = useAppStore((s) => s.setReviewMode);
  const setMode = useCallback(
    (next: ReviewMode) => setReviewMode({ sessionId, mode: next }),
    [sessionId, setReviewMode],
  );
  const [isBusy, setIsBusy] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState<PrLifecycleBusy>(null);
  const { showToast } = useToast();
  const reportError = useAppStore((s) => s.reportError);

  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const branchPrs = useAppStore((s) => selectActiveProjectPrs({ state: s, sessionId }));
  const selectedPrNumber = useAppStore((s) => s.sessionSelectedPrNumber[sessionId] ?? null);
  const comments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const checks = useAppStore((s) => s.sessionGithub[sessionId]?.detail?.checks ?? EMPTY_CHECKS);
  const drafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const reviewTarget = useAppStore((s) => s.reviewTargets[sessionId] ?? null);
  const consumeReviewTarget = useAppStore((s) => s.consumeReviewTarget);
  const loadResolveSession = useAppStore((s) => s.loadResolveSession);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const markPrReady = useAppStore((s) => s.markPrReady);
  const convertPrToDraft = useAppStore((s) => s.convertPrToDraft);
  const mergePr = useAppStore((s) => s.mergePr);
  const closePr = useAppStore((s) => s.closePr);
  const reopenPr = useAppStore((s) => s.reopenPr);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const navigate = useAppStore((s) => s.navigate);
  const publishPrReview = useAppStore((s) => s.publishPrReview);
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);
  const openDiffLens = useAppStore((s) => s.openDiffLens);

  const diffComments = useDiffComments(sessionId);
  const repo = useSessionRepo({ sessionId });
  const worktreePath = repo?.worktreePath ?? null;
  const roleModels = useSessionRoleModels({ sessionId });
  const githubConnection = useGithubConnection({ workspaceId: session.workspaceId });
  const isDraftAgentRunning = usePrDraftAgentRunning({ sessionId });

  const canonicalPr = github?.pr ?? null;
  const prOptions = useMemo(() => {
    if (branchPrs.length > 0) {
      return branchPrs;
    }
    return canonicalPr === null ? EMPTY_PRS : [canonicalPr];
  }, [branchPrs, canonicalPr]);
  const pr =
    prOptions.find((candidate) => candidate.number === selectedPrNumber) ?? canonicalPr ?? null;
  const prWriteTarget =
    pr === null || repo === null ? null : { projectId: repo.projectId, prNumber: pr.number };
  const prWriteClaim = useAppStore((s) => selectPrWrite({ state: s, target: prWriteTarget }));

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  useEffect(() => () => setReviewMode({ sessionId, mode: 'queue' }), [sessionId, setReviewMode]);

  useEffect(() => {
    if (reviewTarget === null || reviewTarget.status === 'pending') {
      return;
    }
    setMode(reviewTarget.mode ?? 'queue');
    const targetThreadId = reviewThreadId({ destination: reviewTarget.destination });
    if (reviewTarget.status === 'ready' && targetThreadId === null) {
      consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
    }
  }, [consumeReviewTarget, reviewTarget, sessionId, setMode]);

  const onMutated = useCallback(() => {
    void refreshSessionPr(sessionId, { force: true });
    void refreshSessionPrDetail(sessionId, { force: true });
  }, [refreshSessionPr, refreshSessionPrDetail, sessionId]);

  const runLifecycle = useCallback(
    async (kind: Exclude<PrLifecycleBusy, null>, action: () => Promise<void>) => {
      if (lifecycleBusy !== null) {
        return;
      }
      setLifecycleBusy(kind);
      try {
        await action();
        onMutated();
      } catch (error) {
        void reportError({
          title: prLifecycleFailureTitle({ action: kind, prNumber: pr?.number ?? null }),
          error,
          sessionId,
        });
      } finally {
        setLifecycleBusy(null);
      }
    },
    [lifecycleBusy, onMutated, pr, reportError, sessionId],
  );

  const startGeneralFix = useCallback(
    (thread: CommentThread) => {
      if (pr === null) {
        return;
      }
      if (worktreePath === null) {
        showToast({
          kind: 'warning',
          message: 'Add the project to this session first. The fix needs its worktree.',
        });
        return;
      }
      const routing = kindRouting({ kind: 'resolver', roleModels });
      const args = buildCommentAgentArgs(
        thread.head,
        pr,
        {
          ...(routing.provider !== undefined && { provider: routing.provider }),
          ...(routing.model !== undefined && { model: routing.model }),
        },
        thread.replies,
      );
      void spawnAgent(sessionId, {
        name: args.name,
        ...(routing.provider !== undefined && { provider: routing.provider }),
        ...(routing.model !== undefined && { model: routing.model }),
        ...(routing.effort !== undefined && routing.effort !== null && { effort: routing.effort }),
        initialPrompt: args.initialPrompt,
        kindOverride: 'resolver',
        sourceCommentUrl: args.sourceCommentUrl,
        sourceKind: args.sourceKind,
        focus: 'none',
      }).catch((error: unknown) =>
        reportError({ title: "Couldn't start the fix agent", error, sessionId }),
      );
    },
    [pr, reportError, roleModels, sessionId, showToast, spawnAgent, worktreePath],
  );

  const onWriteReviewPublish = useCallback(
    async (opts: {
      readonly verdict: Parameters<typeof publishPrReview>[1]['verdict'];
      readonly body: string;
    }) => {
      setIsBusy(true);
      try {
        const result = await publishPrReview(sessionId, opts);
        await loadReviewDrafts(sessionId);
        if (result.failed.length > 0) {
          void reportError({
            title: `Couldn't publish ${result.failed.length} review comments`,
            error: result.failed.map((failure) => failure.error).join('\n'),
            sessionId,
          });
          return;
        }
        showToast({ kind: 'success', message: 'Review submitted' });
      } catch (error) {
        void reportError({ title: "Couldn't submit the review", error, sessionId });
      } finally {
        setIsBusy(false);
      }
    },
    [loadReviewDrafts, publishPrReview, reportError, sessionId, showToast],
  );

  const openDrafts = useMemo(() => drafts.filter((draft) => draft.status === 'draft'), [drafts]);
  const localNotes = useMemo(() => openDiffComments({ comments: diffComments }), [diffComments]);
  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;

  if (pr === null && (!isGithubConnected || repo === null)) {
    return (
      <PaneShell title={REVIEW_TITLE} icon={CONCEPT_ICONS.review}>
        <GithubConnectionEmptyState
          workspaceId={session.workspaceId}
          isConnected={isGithubConnected}
          onConnected={() => void githubConnection.refresh()}
        />
      </PaneShell>
    );
  }

  if (pr === null && mode === 'create_pr') {
    return (
      <PaneShell title="New pull request" icon={CONCEPT_ICONS.review}>
        <CreatePrMode
          sessionId={sessionId}
          defaultTitle={session.goal}
          closedPr={null}
          onCreated={() => {
            setMode('queue');
            onMutated();
          }}
          onCancel={() => setMode('queue')}
        />
      </PaneShell>
    );
  }

  if (pr === null) {
    return (
      <PaneShell title={REVIEW_TITLE} icon={CONCEPT_ICONS.review}>
        <NoPullRequestState
          isDraftAgentRunning={isDraftAgentRunning}
          onDraft={() =>
            isDraftAgentRunning
              ? navigate({ to: sessionPlace({ sessionId, lens: 'agents' }) })
              : setMode('create_pr')
          }
        />
      </PaneShell>
    );
  }

  const isClosed = pr.state === 'closed';
  const mergeReadiness = evaluatePrMergeReadiness({ pr });
  const writeInFlight =
    prWriteClaim === null
      ? null
      : describePrWriteInFlight({ action: prWriteClaim.action, prNumber: pr.number });

  const header = (
    <PrContextRow
      pr={pr}
      prs={prOptions}
      repo={repo?.repoRoot ?? null}
      checks={checks}
      isRefreshing={github?.detailLoading === true}
      actions={
        <PrActionsMenu
          pr={pr}
          busy={lifecycleBusy}
          mergeReadiness={mergeReadiness}
          writeInFlight={writeInFlight}
          canCreateNew={!isDraftAgentRunning}
          onMarkReady={() => void runLifecycle('ready', () => markPrReady(sessionId, pr.number))}
          onConvertDraft={() =>
            void runLifecycle('undraft', () => convertPrToDraft(sessionId, pr.number))
          }
          onClosePr={() => void runLifecycle('close', () => closePr(sessionId, pr.number))}
          onReopen={() => void runLifecycle('reopen', () => reopenPr(sessionId, pr.number))}
          onMerge={() => runLifecycle('merge', () => mergePr(sessionId, pr.number))}
          onCreateNew={() => setMode('create_pr')}
        />
      }
      onSelectPr={(prNumber) => void selectSessionPr(sessionId, prNumber)}
      onRefresh={() => void refreshSessionPrDetail(sessionId, { force: true })}
      onOpenChecks={() => setMode('checks')}
      onOpenOnGithub={() => void openUrl(pr.url)}
    />
  );

  const surface =
    mode === 'pr_details' ? (
      <PrDetailsMode
        sessionId={sessionId}
        pr={pr}
        detail={github?.detail ?? null}
        onSelectLens={(lens) => navigate({ to: sessionPlace({ sessionId, lens: lens }) })}
        onMutated={onMutated}
      />
    ) : mode === 'pr_activity' ? (
      <PrActivityMode
        pr={pr}
        comments={comments}
        localNotes={localNotes}
        onOpenUrl={(url) => void openUrl(url)}
        onOpenConversations={() => setMode('queue')}
        onOpenLocalNotes={() => openDiffLens(sessionId, { kind: 'working', path: null })}
        onFix={startGeneralFix}
      />
    ) : mode === 'checks' ? (
      <ChecksMode checks={checks} fallbackUrl={pr.url} onOpenUrl={(url) => void openUrl(url)} />
    ) : mode === 'create_pr' ? (
      <CreatePrMode
        sessionId={sessionId}
        defaultTitle={session.goal}
        closedPr={isClosed ? { number: pr.number, url: pr.url } : null}
        onCreated={() => {
          setMode('queue');
          onMutated();
        }}
        onCancel={() => setMode('pr_details')}
      />
    ) : mode === 'write_review' ? (
      <WriteReview session={session} />
    ) : null;

  const dock =
    mode === 'write_review' ? (
      <PublishBar
        sessionId={sessionId}
        provider="github"
        draftCount={openDrafts.length}
        publishing={isBusy}
        onPublish={(opts) => void onWriteReviewPublish(opts)}
      />
    ) : (
      <PublishConversationsBar
        sessionId={sessionId}
        draftCount={openDrafts.length}
        mode={mode}
        onSelectMode={setMode}
      />
    );

  if (mode === 'queue') {
    return <ResolveQueueHome session={session} header={header} dock={dock} />;
  }

  return (
    <PaneShell header={header} scroll={mode === 'write_review' ? 'self' : 'body'} dock={dock}>
      {surface}
    </PaneShell>
  );
};
