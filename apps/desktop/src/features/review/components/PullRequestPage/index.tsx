import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PencilLine } from 'lucide-react';
import { Button, GhostActionButton, Notice } from '@goodboy/ui';
import type {
  PrCheckRun,
  PrComment,
  PrReview,
  PrReviewDraft,
  PullRequestState,
  Session,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, sessionPlace } from '../../../../store';
import { selectActiveProjectPrs } from '../../../../store/slices/github/activeProjectPrs';
import { selectPrWrite } from '../../../../store/slices/pr-writes/selectPrWrite';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { useToast } from '../../../../app/components/Toast';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { GithubConnectionEmptyState } from '../../../github/components/GithubConnectionEmptyState';
import { useGithubConnection } from '../../../integrations/github/useGithubConnection';
import { usePrDraftAgentRunning } from '../../../github/usePrDraftAgentRunning';
import { buildCommentAgentArgs } from '../../../chat/spawn-from-comment';
import { kindRouting } from '../../../session/agent-kind';
import type { CommentThread } from '../../../github/comment-threads';
import {
  PR_LIFECYCLE_ACTIONS,
  prLifecycleFailureTitle,
  describePrWriteInFlight,
  type PrLifecycleAction,
  type PrLifecycleBusy,
} from '../../prLifecycle';
import { evaluatePrMergeReadiness } from '../../prMergeReadiness';
import { openReview } from '../../openReview';
import { pullRequestCta, pullRequestCtaTitle, RESOLVE_IN_REVIEW } from '../../pullRequestCta';
import { MergeReadinessNote } from '../ReviewPane/MergeReadinessNote';
import { PrActionsMenu } from '../ReviewPane/PrActionsMenu';
import { PrContextRow } from '../ReviewPane/PrContextRow';
import { ChecksMode } from '../ReviewPane/modes/ChecksMode';
import { CreatePrMode } from '../ReviewPane/modes/CreatePrMode';
import { PrActivityMode } from '../ReviewPane/modes/PrActivityMode';
import { PrDetailsMode } from '../ReviewPane/modes/PrDetailsMode';
import { WriteReview } from '../ReviewPane/WriteReview';
import { PublishBar } from '../ReviewPane/WriteReview/PublishBar';

type LifecycleRun = {
  readonly kind: PrLifecycleAction;
  readonly action: () => Promise<void>;
};

type Props = {
  readonly session: Session;
};

const EMPTY_CHECKS: ReadonlyArray<PrCheckRun> = [];
const EMPTY_REVIEWS: ReadonlyArray<PrReview> = [];
const EMPTY_PRS: ReadonlyArray<PullRequestState> = [];
export const PULL_REQUEST_TITLE = 'Pull request';
export const NEW_PULL_REQUEST_TITLE = 'New pull request';
export const WRITE_REVIEW_LABEL = 'Write review';

export const PullRequestPage = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const mode = useAppStore((s) => s.pullRequestModes[sessionId] ?? 'overview');
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const setMode = useCallback(
    (next: 'overview' | 'write_review' | 'create_pr') =>
      setPullRequestMode({ sessionId, mode: next }),
    [sessionId, setPullRequestMode],
  );
  const [isBusy, setIsBusy] = useState(false);
  const checksRef = useRef<HTMLDivElement | null>(null);
  const lifecycle = usePendingAction({ sessionId });
  const lifecycleBusy: PrLifecycleBusy =
    PR_LIFECYCLE_ACTIONS.find((action) => lifecycle.pendingKeys.has(action)) ?? null;
  const { showToast } = useToast();
  const reportError = useAppStore((s) => s.reportError);

  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const branchPrs = useAppStore((s) => selectActiveProjectPrs({ state: s, sessionId }));
  const selectedPrNumber = useAppStore((s) => s.sessionSelectedPrNumber[sessionId] ?? null);
  const comments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const reviews = useAppStore((s) => s.sessionGithub[sessionId]?.detail?.reviews ?? EMPTY_REVIEWS);
  const checks = useAppStore((s) => s.sessionGithub[sessionId]?.detail?.checks ?? EMPTY_CHECKS);
  const drafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
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

  useEffect(() => () => setMode('overview'), [setMode]);

  const onMutated = useCallback(() => {
    void refreshSessionPr(sessionId, { force: true });
    void refreshSessionPrDetail(sessionId, { force: true });
  }, [refreshSessionPr, refreshSessionPrDetail, sessionId]);

  const runLifecycle = useCallback(
    async ({ kind, action }: LifecycleRun) => {
      if (lifecycle.pendingKeys.size > 0) {
        return;
      }
      const isDone = await lifecycle.run({
        key: kind,
        failureTitle: prLifecycleFailureTitle({ action: kind, prNumber: pr?.number ?? null }),
        task: action,
      });
      if (isDone) {
        onMutated();
      }
    },
    [lifecycle, onMutated, pr],
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
  const cta = useMemo(() => pullRequestCta({ comments, reviews }), [comments, reviews]);
  const isGithubConnected =
    githubConnection.isResolved === false || githubConnection.isAuthenticated;

  if (pr === null && (!isGithubConnected || repo === null)) {
    return (
      <PaneShell title={PULL_REQUEST_TITLE} icon={CONCEPT_ICONS.pr}>
        <GithubConnectionEmptyState
          workspaceId={session.workspaceId}
          isConnected={isGithubConnected}
          onConnected={() => void githubConnection.refresh()}
        />
      </PaneShell>
    );
  }

  if (pr === null || mode === 'create_pr') {
    const isClosed = pr?.state === 'closed';
    return (
      <PaneShell title={NEW_PULL_REQUEST_TITLE} icon={CONCEPT_ICONS.pr} scroll="body">
        {isDraftAgentRunning && pr === null ? (
          <Notice
            tone="info"
            placement="inline"
            title="An agent is drafting the pull request"
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate({ to: sessionPlace({ sessionId, lens: 'agents' }) })}
              >
                Follow the drafting agent
              </Button>
            }
          />
        ) : (
          <CreatePrMode
            sessionId={sessionId}
            defaultTitle={session.goal}
            closedPr={pr !== null && isClosed ? { number: pr.number, url: pr.url } : null}
            onCreated={() => {
              setMode('overview');
              onMutated();
            }}
            onCancel={() =>
              pr === null
                ? navigate({ to: sessionPlace({ sessionId, lens: 'review' }) })
                : setMode('overview')
            }
          />
        )}
      </PaneShell>
    );
  }

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
        <>
          <GhostActionButton
            icon={PencilLine}
            label={
              openDrafts.length > 0
                ? `${WRITE_REVIEW_LABEL} (${openDrafts.length})`
                : WRITE_REVIEW_LABEL
            }
            pressed={mode === 'write_review'}
            onClick={() => setMode(mode === 'write_review' ? 'overview' : 'write_review')}
          />
          <PrActionsMenu
            pr={pr}
            busy={lifecycleBusy}
            mergeReadiness={mergeReadiness}
            writeInFlight={writeInFlight}
            canCreateNew={!isDraftAgentRunning}
            onMarkReady={() =>
              void runLifecycle({ kind: 'ready', action: () => markPrReady(sessionId, pr.number) })
            }
            onConvertDraft={() =>
              void runLifecycle({
                kind: 'undraft',
                action: () => convertPrToDraft(sessionId, pr.number),
              })
            }
            onClosePr={() =>
              void runLifecycle({ kind: 'close', action: () => closePr(sessionId, pr.number) })
            }
            onReopen={() =>
              void runLifecycle({ kind: 'reopen', action: () => reopenPr(sessionId, pr.number) })
            }
            onMerge={() =>
              runLifecycle({ kind: 'merge', action: () => mergePr(sessionId, pr.number) })
            }
            onCreateNew={() => setMode('create_pr')}
          />
        </>
      }
      onSelectPr={(prNumber) => void selectSessionPr(sessionId, prNumber)}
      onRefresh={() => void refreshSessionPrDetail(sessionId, { force: true })}
      onOpenChecks={() => checksRef.current?.scrollIntoView({ block: 'start' })}
      onOpenOnGithub={() => void openUrl(pr.url)}
    />
  );

  if (mode === 'write_review') {
    return (
      <PaneShell header={header} scroll="self">
        <WriteReview
          session={session}
          publishBar={
            <PublishBar
              sessionId={sessionId}
              provider="github"
              draftCount={openDrafts.length}
              publishing={isBusy}
              onPublish={(opts) => void onWriteReviewPublish(opts)}
            />
          }
        />
      </PaneShell>
    );
  }

  return (
    <PaneShell header={header} scroll="body">
      <div className="flex min-w-0 flex-col gap-8">
        {cta === null ? (
          <MergeReadinessNote readiness={mergeReadiness} />
        ) : (
          <Notice
            tone="warning"
            placement="inline"
            title={pullRequestCtaTitle(cta)}
            actions={
              <Button size="sm" variant="primary" onClick={() => void openReview({ sessionId })}>
                {RESOLVE_IN_REVIEW}
              </Button>
            }
          />
        )}
        <PrDetailsMode
          sessionId={sessionId}
          pr={pr}
          detail={github?.detail ?? null}
          onSelectLens={(lens) => navigate({ to: sessionPlace({ sessionId, lens }) })}
          onMutated={onMutated}
        />
        <div ref={checksRef} className="min-w-0">
          <ChecksMode checks={checks} fallbackUrl={pr.url} onOpenUrl={(url) => void openUrl(url)} />
        </div>
        <PrActivityMode
          pr={pr}
          comments={comments}
          onOpenUrl={(url) => void openUrl(url)}
          onOpenConversations={() => void openReview({ sessionId })}
          onFix={startGeneralFix}
        />
      </div>
    </PaneShell>
  );
};
