import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { EmptyState, formatError } from '@goodboy/ui';
import {
  buildCombinedCommentAgentArgs,
  buildCommentAgentArgs,
  type CommentAgentArgs,
  type ResolveModelChoice,
} from '../../../chat/spawn-from-comment';
import { useResolverIndex } from '../../../session/hooks/useResolverIndex';
import { resolverForComment, type ResolverLink } from '../../../session/resolver-linkage';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { openUrl } from '../../../../shared/lib/editor';
import { HeaderBand, StudioDetailTabs } from '@goodboy/ui';
import { githubPullRequestFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { BranchPair } from '@goodboy/ui';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { RefreshIconButton } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore, useSessions } from '../../../../store';
import { groupThreads, type CommentThread } from '../../comment-threads';
import { PullRequestChip } from '../PullRequestChip';
import { CreatePrPanel } from './CreatePrPanel';
import { PrActionBar, type ActionBusy } from './PrActionBar';
import type { PrVerdictSubmission } from './PrVerdictAction';
import { PrChecks } from './PrChecks';
import { PrConversation } from './PrConversation';
import { ResolveBoard } from './ResolveBoard';
import { PrOverview } from './PrOverview';
import { PrReviewers } from './PrReviewers';
import { PrSwitcher } from './PrSwitcher';
import { ResolverSpawnStatus } from './ResolverSpawnStatus';
import { SectionBody } from './SectionBody';
import type { PrSection } from './prSection';
import { prSectionOptions } from './prSectionOptions';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { githubReviewTarget } from '../../../../store/slices/review-drafts/githubReviewTarget';
import type { PublishPrReviewVerdict } from '../../../../store/slices/review-drafts/types';
import { useToast } from '../../../../app/components/Toast';

const VERDICT_TOAST = {
  comment: 'Comment posted on the pull request',
  approve: 'Pull request approved',
  request_changes: 'Changes requested on the pull request',
} satisfies Record<PublishPrReviewVerdict, string>;

type Props = {
  readonly sessionId: SessionId | null;
  readonly initialPrNumber?: number | null;
  readonly initialThreadId?: string | null;
  readonly onClose: () => void;
};

export const PrDetailPanel = ({
  sessionId,
  initialPrNumber = null,
  initialThreadId = null,
  onClose,
}: Props) => {
  const sessions = useSessions();
  const session =
    sessionId != null ? sessions.find((candidate) => candidate.id === sessionId) : undefined;
  const github = useAppStore((state) =>
    sessionId != null ? state.sessionGithub[sessionId] : null,
  );
  const prs = useAppStore((state) =>
    sessionId != null ? (state.sessionGithubPrs[sessionId] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  );
  const selectedNumber = useAppStore((state) =>
    sessionId != null ? (state.sessionSelectedPrNumber[sessionId] ?? null) : null,
  );
  const repo = useSessionRepo({ sessionId: (sessionId ?? '') as SessionId });
  const workspaceRoot = repo?.repoRoot ?? null;
  const roleModels = useSessionRoleModels({ sessionId });
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const markPrReady = useAppStore((s) => s.markPrReady);
  const convertPrToDraft = useAppStore((s) => s.convertPrToDraft);
  const mergePr = useAppStore((s) => s.mergePr);
  const closePr = useAppStore((s) => s.closePr);
  const reopenPr = useAppStore((s) => s.reopenPr);
  const requestReview = useAppStore((s) => s.requestReview);
  const publishPrReview = useAppStore((s) => s.publishPrReview);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const activateNextResolver = useAppStore((s) => s.activateNextResolver);
  const setAgentConfig = useAppStore((s) => s.setAgentConfig);

  const resolverIndex = useResolverIndex((sessionId ?? '') as SessionId);
  const resolverFor = useCallback(
    (thread: CommentThread): ResolverLink | undefined =>
      resolverForComment(resolverIndex, { threadId: thread.head.threadId, url: thread.head.url }),
    [resolverIndex],
  );

  const { showToast } = useToast();
  const [busy, setBusy] = useState<ActionBusy>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [section, setSection] = useState<PrSection>('overview');
  const [jumpThreadId, setJumpThreadId] = useState<string | null>(null);
  const [spawnedResolverIds, setSpawnedResolverIds] = useState<ReadonlyArray<AgentId>>([]);
  const requestedPrRef = useRef<string | null>(null);

  const primary = github?.pr ?? null;
  const primaryNumber = primary?.number ?? null;
  const options = prs.length > 0 ? prs : primary != null ? [primary] : [];
  const selectedPr =
    selectedNumber != null
      ? (options.find((candidate) => candidate.number === selectedNumber) ?? null)
      : null;
  const selected = selectedPr?.number ?? primaryNumber;
  const activePr = options.find((pr) => pr.number === selected) ?? primary;
  const detail = github?.detail ?? null;
  const detailLoading = github?.detailLoading === true;
  const detailError = github?.detailError ?? null;
  const sectionOptions = useMemo(
    () => (activePr == null ? [] : prSectionOptions({ pr: activePr, detail })),
    [activePr, detail],
  );
  const properties = useMemo(
    () =>
      activePr == null
        ? null
        : resolveDetailFields({ registry: githubPullRequestFields, entity: activePr }),
    [activePr],
  );

  useEffect(() => {
    setCreateOpen(false);
    setSection('overview');
    setSpawnedResolverIds([]);
  }, [sessionId]);

  useEffect(() => {
    if (sessionId == null || initialPrNumber == null) {
      return;
    }
    const requested = `${sessionId}:${initialPrNumber}`;
    if (requestedPrRef.current === requested) {
      return;
    }
    if (!options.some((candidate) => candidate.number === initialPrNumber)) {
      return;
    }
    requestedPrRef.current = requested;
    void selectSessionPr(sessionId, initialPrNumber);
  }, [sessionId, initialPrNumber, options, selectSessionPr]);

  useEffect(() => {
    if (initialThreadId == null) {
      return;
    }
    setSection('comments');
  }, [initialThreadId]);

  useEffect(() => {
    if (sessionId == null || activePr == null) {
      return;
    }
    if (github?.detail == null && github?.detailLoading !== true && github?.detailError == null) {
      void refreshSessionPrDetail(sessionId);
    }
  }, [
    sessionId,
    activePr,
    github?.detail,
    github?.detailLoading,
    github?.detailError,
    refreshSessionPrDetail,
  ]);

  if (sessionId == null || session == null) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.pr}
          icon={CONCEPT_ICONS.pr}
          title="No session selected"
          description="Pick a session from the inbox to see its pull request."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const refreshActive = () => {
    if (activePr == null) {
      return;
    }
    void refreshSessionPrDetail(sessionId, { force: true });
  };

  const onMutated = refreshActive;

  const spawnResolver = async (
    args: CommentAgentArgs,
    choice: ResolveModelChoice,
    deferKickoff: boolean,
  ) => {
    const agentId = await spawnAgent(sessionId, {
      name: args.name,
      model: args.model,
      ...(args.provider !== undefined && { provider: args.provider }),
      effort: args.effort,
      initialPrompt: args.initialPrompt,
      kindOverride: args.kind,
      ...(args.sourceThreadId !== undefined && { sourceThreadId: args.sourceThreadId }),
      ...(args.sourceThreadIds !== undefined && { sourceThreadIds: args.sourceThreadIds }),
      sourceCommentUrl: args.sourceCommentUrl,
      sourceKind: args.sourceKind,
      ...(deferKickoff && { deferKickoff: true }),
      focus: 'none',
    });
    await setAgentConfig(sessionId, agentId, {
      ...(choice.provider !== undefined && { providerOverride: choice.provider }),
      ...(choice.model !== undefined && { modelOverride: choice.model }),
      effort: args.effort,
    });
    setSpawnedResolverIds((prev) => [...prev, agentId]);
    return agentId;
  };

  const openResolver = (agentId: AgentId) => {
    void (async () => {
      await setCurrentSession(sessionId);
      setActiveLens(sessionId, 'resolve');
      await selectAgent(sessionId, agentId);
      onClose();
    })();
  };

  const openResolveLane = () => {
    void (async () => {
      await setCurrentSession(sessionId);
      setActiveLens(sessionId, 'resolve');
      onClose();
    })();
  };

  const onViewSpawned = () => {
    const only = spawnedResolverIds.length === 1 ? spawnedResolverIds[0] : undefined;
    if (only !== undefined) {
      openResolver(only);
      return;
    }
    openResolveLane();
  };

  const onSpawnOne = (thread: CommentThread, choice: ResolveModelChoice) => {
    if (activePr == null) {
      return;
    }
    const existing = resolverFor(thread);
    if (existing != null && existing.status !== 'failed') {
      openResolver(existing.agent.id as AgentId);
      return;
    }
    void spawnResolver(
      buildCommentAgentArgs(thread.head, activePr, choice, thread.replies),
      choice,
      false,
    );
  };

  const onSpawnBatch = (
    batch: ReadonlyArray<CommentThread>,
    choiceById: Readonly<Record<string, ResolveModelChoice>>,
  ) => {
    if (activePr == null || batch.length === 0) {
      return;
    }
    const fresh = batch.filter((t) => {
      const existing = resolverFor(t);
      return existing == null || existing.status === 'failed';
    });
    if (fresh.length === 0) {
      return;
    }
    void (async () => {
      for (const t of fresh) {
        const choice = choiceById[t.head.id] ?? {};
        await spawnResolver(
          buildCommentAgentArgs(t.head, activePr, choice, t.replies),
          choice,
          true,
        );
      }
      await activateNextResolver(sessionId);
    })();
  };

  const onSpawnCombined = (batch: ReadonlyArray<CommentThread>, choice: ResolveModelChoice) => {
    if (activePr == null || batch.length < 2 || batch.length > 8) {
      return;
    }
    const fresh = batch.filter((thread) => {
      const existing = resolverFor(thread);
      return existing == null || existing.status === 'failed';
    });
    if (fresh.length < 2) {
      return;
    }
    void (async () => {
      await spawnResolver(buildCombinedCommentAgentArgs(fresh, activePr, choice), choice, true);
      await activateNextResolver(sessionId);
    })();
  };

  const run = async (kind: Exclude<ActionBusy, null>, fn: () => Promise<void>) => {
    if (busy != null) {
      return;
    }
    setBusy(kind);
    try {
      await fn();
      onMutated();
    } catch {
      void 0;
    } finally {
      setBusy(null);
    }
  };

  const onAddReviewers = (logins: ReadonlyArray<string>) => {
    if (activePr == null) {
      return;
    }
    void (async () => {
      try {
        await requestReview(sessionId, activePr.number, logins);
      } catch {
        void 0;
      }
      onMutated();
    })();
  };

  if (activePr == null) {
    return (
      <div className="flex h-full flex-col">
        <CreatePrPanel
          sessionId={sessionId}
          defaultTitle={session.goal}
          onCreated={onMutated}
          onStudioClose={onClose}
        />
      </div>
    );
  }

  const isTerminal = activePr.state === 'merged' || activePr.state === 'closed';
  const isClosed = activePr.state === 'closed';
  const isDraft = activePr.isDraft;
  const canMerge = !isTerminal && !isDraft && activePr.mergeable !== false;
  const mergeReason = isDraft
    ? 'mark the PR ready before merging'
    : activePr.mergeable === false
      ? 'PR has conflicts, resolve them first'
      : 'squash merge this PR';
  const num = activePr.number;
  const hasStateActions = !isTerminal || isClosed;
  const verdictTarget = githubReviewTarget({ url: activePr.url, prNumber: num });

  const submitVerdict = async ({ verdict, body }: PrVerdictSubmission) => {
    if (busy != null || verdictTarget == null) {
      return;
    }
    setBusy('review');
    try {
      const result = await publishPrReview(sessionId, { verdict, body, target: verdictTarget });
      onMutated();
      const failure = result.failed[0];
      if (failure != null) {
        showToast('error', `Review not posted: ${failure.error}`);
        return;
      }
      const mismatchedNote =
        result.mismatched.length > 0
          ? `, ${result.mismatched.length} left for a different pull request`
          : '';
      showToast('success', `${VERDICT_TOAST[verdict]}${mismatchedNote}`);
    } catch (err) {
      showToast('error', formatError(err));
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <>
      <HeaderBand
        meta={
          options.length > 1 ? (
            <PrSwitcher
              prs={options}
              selected={selected}
              onSelect={(prNumber) => void selectSessionPr(sessionId, prNumber)}
            />
          ) : (
            <PullRequestChip
              state={activePr.isDraft ? 'draft' : activePr.state}
              variant="badge"
              number={activePr.number}
              iconSize={12}
            />
          )
        }
        title={activePr.title}
        subtitle={<BranchPair headBranch={activePr.headBranch} baseBranch={activePr.baseBranch} />}
        actions={
          <>
            <OpenSessionButton sessionId={sessionId} onOpened={onClose} variant="ghost" />
            <ExternalRefActions
              url={activePr.url}
              label={`PR #${activePr.number}`}
              hostLabel="GitHub"
            />
            <RefreshIconButton
              label="Refresh"
              iconSize={14}
              isLoading={detailLoading}
              onClick={refreshActive}
            />
          </>
        }
      />
      {hasStateActions && (
        <PrActionBar
          pr={activePr}
          busy={busy}
          canMerge={canMerge}
          canReview={verdictTarget != null}
          mergeReason={mergeReason}
          onSubmitVerdict={(submission) => void submitVerdict(submission)}
          onMarkReady={() => void run('ready', () => markPrReady(sessionId, num))}
          onConvertDraft={() => void run('undraft', () => convertPrToDraft(sessionId, num))}
          onClose={() => void run('close', () => closePr(sessionId, num))}
          onReopen={() => void run('reopen', () => reopenPr(sessionId, num))}
          onCreateNew={() => setCreateOpen(true)}
          onMerge={() => run('merge', () => mergePr(sessionId, num))}
        />
      )}
    </>
  );

  if (createOpen) {
    return (
      <StudioDetailLayout header={header} fit="bleed">
        <CreatePrPanel
          sessionId={sessionId}
          defaultTitle={session.goal}
          closedPr={isClosed ? { number: activePr.number, url: activePr.url } : undefined}
          onCreated={() => {
            setCreateOpen(false);
            onMutated();
          }}
          onCancel={() => setCreateOpen(false)}
          onStudioClose={onClose}
        />
      </StudioDetailLayout>
    );
  }

  return (
    <StudioDetailLayout
      header={header}
      tabs={
        <StudioDetailTabs
          ariaLabel="Pull request sections"
          options={sectionOptions}
          value={section}
          onChange={setSection}
        />
      }
      rail={
        <PrReviewers
          detail={detail}
          workspaceRoot={workspaceRoot}
          memberWorkspaceId={repo?.workspaceId}
          onAddReviewers={onAddReviewers}
        />
      }
      {...(properties != null && { properties })}
    >
      {section === 'overview' ? (
        <PrOverview pr={activePr} sessionId={sessionId} onMutated={onMutated} />
      ) : (
        <SectionBody
          detailLoading={detailLoading}
          detailError={detailError}
          detail={detail}
          onRetry={refreshActive}
        >
          {section === 'resolve' ? (
            <div className="flex flex-col gap-3">
              <ResolverSpawnStatus
                sessionId={sessionId}
                spawnedIds={spawnedResolverIds}
                onView={onViewSpawned}
              />
              <ResolveBoard
                threads={groupThreads(detail?.comments ?? []).filter(
                  (thread) => thread.head.source === 'review' && thread.head.resolved === false,
                )}
                resolverFor={resolverFor}
                onSpawnOne={onSpawnOne}
                onSpawnBatch={onSpawnBatch}
                onSpawnCombined={onSpawnCombined}
                onOpenResolver={openResolver}
                roleModels={roleModels}
                onOpenThread={(threadId) => {
                  setJumpThreadId(threadId);
                  setSection('comments');
                }}
              />
            </div>
          ) : section === 'comments' ? (
            <PrConversation
              comments={detail?.comments ?? []}
              pr={activePr}
              resolverFor={resolverFor}
              scrollToThreadId={jumpThreadId ?? initialThreadId}
              onOpenUrl={(url) => void openUrl(url)}
            />
          ) : (
            <PrChecks
              checks={detail?.checks ?? []}
              fallbackUrl={activePr.url}
              hostLabel="GitHub"
              onOpenUrl={(url) => void openUrl(url)}
            />
          )}
        </SectionBody>
      )}
    </StudioDetailLayout>
  );
};
