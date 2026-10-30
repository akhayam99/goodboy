import type { RetryRunParams } from '../../retryRun';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AgentId, OpenQuestion, ProviderRunId, Session } from '@goodboy/types';
import { cn, PANE_RHYTHM, ScrollFade } from '@goodboy/ui';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionSlackDrafts,
  useTranscript,
} from '../../../../store';
import { reduceTranscript } from '../../utils/transcript-items';
import { clusterOperations } from '../../utils/cluster-operations';
import { conversationRows } from '../../utils/conversationRows';
import { useAgentStop } from '../../../../shared/hooks/useAgentStop';
import { livePhraseOf } from '../../utils/livePhraseOf';
import { permissionFor, toolStatus } from '../../utils/toolStatus';
import { turnFootersFor } from '../../utils/turnOutcome';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { useProviderHealth } from '../../../../shared/hooks/useProviderHealth';
import { ChatInput } from '../ChatInput';
import { ConversationColumn } from '../ConversationColumn';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { MountSuggestionCard } from '../MountSuggestionCard';
import { useTranscriptMountProposals } from '../../../suggestions/useTranscriptMountProposals';
import { useMountProposalActions } from '../../../suggestions/useMountProposalActions';
import { mountProposalsByRun } from '../../../suggestions/transcriptMountProposals';
import { ChatEmptyState } from './ChatEmptyState';
import { OtherAgentQuestionButton } from './parts/OtherAgentQuestionButton';
import { TranscriptRows } from './TranscriptRows';
import { ChatImageLoaderProvider } from './ChatImageLoaderProvider';
import { JumpToLatest } from './JumpToLatest';
import { firstUnseenRowKeyOf } from './firstUnseenRowKeyOf';
import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { revealPacer } from '../../reveal/revealPacer';
import { useScrollPin } from './useScrollPin';
import { listenUserInput } from './listenUserInput';
import { findRetrySource } from './findRetrySource';
import { buildRetryOverride } from './buildRetryOverride';
import { useScrollAnchor } from '../../../../shared/hooks/useScrollAnchor';
import { rowHeightCache } from './rowHeightCache';
import { TranscriptSkeleton } from './parts/TranscriptSkeleton';
import { WorkflowAdvanceStack } from './parts/WorkflowAdvanceStack';
import { QuestionWaitingPill } from './parts/QuestionWaitingPill';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { missingAttachmentsMessage, readRetryAttachments } from './readRetryAttachments';
import { useToast } from '../../../../shared/components/Toast';

import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { isTurnThinking } from '../../utils/isTurnThinking';
import { turnStateOf } from './turnStateOf';
import { waitingForOf } from './waitingForOf';
import { useTurnEndAnnouncement } from './useTurnEndAnnouncement';
import type { OpenTranscriptAt } from '../../openTranscriptAt';
import type { ComposerControlSlots } from '../ChatInput/composerControlSlots';

type Props = {
  readonly session: Session;
  readonly isActive?: boolean;
  readonly agentId?: AgentId | null;
  readonly topInset?: 'roomy' | 'tight';
  readonly hasComposer?: boolean;
  readonly composerPlaceholder?: string;
  readonly composerNotice?: ReactNode;
  readonly briefLabel?: string;
  readonly insertions?: ReadonlyArray<TranscriptInsertion>;
  readonly composerLead?: ReactNode;
  readonly controlSlots?: ComposerControlSlots;
  readonly mode?: ChatViewMode;
  readonly onOpenTranscript?: OpenTranscriptAt;
  readonly hasAdvanceRow?: boolean;
  readonly stopLabel?: string;
  readonly clockStepAgentId?: AgentId;
};

type ChatViewMode = 'conversation' | 'record' | 'steps';

const TRANSCRIPT_ROW_SELECTOR = '[data-find-root] > li > ul > li';

export const ChatView = ({
  session,
  isActive = true,
  agentId,
  topInset = 'roomy',
  hasComposer = true,
  composerPlaceholder,
  composerNotice,
  briefLabel,
  insertions,
  composerLead,
  controlSlots,
  mode = 'record',
  onOpenTranscript,
  hasAdvanceRow = true,
  stopLabel,
  clockStepAgentId,
}: Props) => {
  const storedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null) as AgentId | null;
  const selectedAgentId = agentId === undefined ? storedAgentId : agentId;
  const sendTurn = useAppStore((s) => s.sendTurn);
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();
  const events = useTranscript(selectedAgentId);
  const items = useMemo(() => reduceTranscript(events), [events]);
  const [retryingRunId, setRetryingRunId] = useState<ProviderRunId | null>(null);
  const taggedItems = useMemo(
    () => ({ agentId: selectedAgentId, items }),
    [selectedAgentId, items],
  );
  const deferredTagged = useDeferredValue(taggedItems);
  const transcriptStale = deferredTagged.agentId !== selectedAgentId;
  const deferredItems = deferredTagged.items;
  const loading = useSessionLoading(session.id);
  const transcriptCached = useAppStore((s) =>
    selectedAgentId ? s.transcripts[selectedAgentId] !== undefined : true,
  );
  const loadAgentTranscript = useAppStore((s) => s.loadAgentTranscript);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const markAgentViewed = useAppStore((s) => s.markAgentViewed);
  const selectedAgentLastFinishedAt = useAppStore((s) =>
    selectedAgentId
      ? (s.sessionPhaseRuns[session.id]?.find((r) => r.id === selectedAgentId)?.lastFinishedAt ??
        null)
      : null,
  );
  const selectedAgentLastViewedAt = useAppStore((s) =>
    selectedAgentId
      ? (s.sessionPhaseRuns[session.id]?.find((r) => r.id === selectedAgentId)?.lastViewedAt ??
        null)
      : null,
  );

  useEffect(() => {
    if (!isActive || !selectedAgentId || transcriptCached) {
      return;
    }
    void loadAgentTranscript(session.id, selectedAgentId, { isSelecting: agentId === undefined });
  }, [isActive, selectedAgentId, transcriptCached, loadAgentTranscript, session.id, agentId]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadSessionArtifacts(session.id);
  }, [isActive, loadSessionArtifacts, session.id]);

  useEffect(() => {
    if (!isActive || !selectedAgentId || !selectedAgentLastFinishedAt) {
      return;
    }
    if (selectedAgentLastViewedAt && selectedAgentLastViewedAt >= selectedAgentLastFinishedAt) {
      return;
    }
    void markAgentViewed(session.id, selectedAgentId);
  }, [
    isActive,
    selectedAgentId,
    selectedAgentLastFinishedAt,
    selectedAgentLastViewedAt,
    markAgentViewed,
    session.id,
  ]);

  const worktreePath = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const diffWorktreePath = useAppStore(
    (state) => resolveSessionRepo({ state, sessionId: session.id })?.worktreePath ?? null,
  );
  const isBranchless = useAppStore((s) =>
    isBranchlessSession({
      branch: s.sessionBranches[session.id],
    }),
  );
  const authResults = useAppStore((s) => s.authResults);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const openQuestions = useSessionOpenQuestions(session.id);
  const agentQuestionCount = openQuestions.filter(
    (question) => question.createdByAgentId === selectedAgentId,
  ).length;
  const { scrollerRef, pinned, onScroll, userInput, jumpToLatest, isHolding } = useScrollPin({
    deps: [deferredItems, agentQuestionCount],
    resetKey: selectedAgentId,
    onRevealOverflow: ({ keys }) => {
      for (const key of keys) {
        revealPacer.flush({ key });
      }
    },
  });
  const fadeHostRef = useRef<HTMLDivElement>(null);

  const provider = session.providerPreference.defaultProvider;
  const providerIdentity = authResults?.[provider]?.identity ?? null;
  const providerHealth = useProviderHealth({ providerId: provider });
  const isProviderDisconnected = providerHealth.standing === 'signed_out';

  const agentState = useAppStore((s) => {
    return selectedAgentId ? (s.agentTurnState[selectedAgentId] ?? null) : null;
  });
  const turnStateForRun = turnStateOf({ agentState, selectedAgentId, session });
  const agentKind = turnStateForRun.kind;
  const isEnded = agentKind === 'ended';
  const activeRunId =
    turnStateForRun.kind === 'running' || turnStateForRun.kind === 'blocked'
      ? turnStateForRun.runId
      : null;
  const turnFooters = useMemo(() => turnFootersFor({ items, activeRunId }), [items, activeRunId]);
  const isConversation = mode === 'conversation';
  const isTurnLive = activeRunId !== null;
  const rows = useMemo(
    () =>
      isConversation
        ? conversationRows({ items: deferredItems, isLive: isTurnLive })
        : clusterOperations(deferredItems),
    [deferredItems, isConversation, isTurnLive],
  );
  const unseenSince = useAppStore((state) =>
    selectedAgentId == null ? null : (state.agentUnseenSince[selectedAgentId] ?? null),
  );
  const newFromKey = useMemo(
    () =>
      firstUnseenRowKeyOf({
        rows,
        sinceMs: unseenSince === null ? null : Date.parse(unseenSince),
      }),
    [rows, unseenSince],
  );
  useTurnEndAnnouncement({ isTurnLive, rows });
  const lastItem = items[items.length - 1];
  const lastRow = rows[rows.length - 1];
  const lastClusterRunning =
    !isConversation &&
    lastRow?.kind === 'operations' &&
    lastRow.items.some(
      (i) =>
        i.kind === 'tool_call' &&
        toolStatus({
          item: i,
          activeRunId,
          permission: permissionFor({ items: lastRow.items, toolUseId: i.toolUseId }),
        }) === 'running',
    );
  const agentStop = useAgentStop({ sessionId: session.id, agentId: selectedAgentId });
  const canStop = hasComposer && !isEnded && selectedAgentId != null;
  const isThinking =
    isConversation || canStop
      ? agentKind === 'running' || agentKind === 'starting'
      : isTurnThinking({
          isTurnRunning: agentKind === 'running',
          lastItem,
          isLastClusterRunning: lastClusterRunning,
        });
  const thinkingStartedAt = turnStateForRun.kind === 'running' ? turnStateForRun.startedAt : null;
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const selectedMountId = phaseRuns.find((agent) => agent.id === selectedAgentId)?.mountId;
  const projectName = useAppStore((s) =>
    selectedMountId === undefined
      ? null
      : ((s.sessionProjectMounts[session.id] ?? []).find(
          (mount) => mount.mountId === selectedMountId,
        )?.mountName ?? null),
  );
  const thinkingPhrase = useMemo(
    () => livePhraseOf({ lastItem, project: projectName }),
    [lastItem, projectName],
  );
  const waitingFor = useMemo(
    () => waitingForOf({ agents: phaseRuns, parentId: selectedAgentId }),
    [phaseRuns, selectedAgentId],
  );

  useLayoutEffect(() => {
    const inputRoot = fadeHostRef.current;
    const viewport = inputRoot?.querySelector<HTMLDivElement>('.overflow-y-auto');
    if (inputRoot == null || viewport == null) {
      return;
    }
    scrollerRef.current = viewport;
    viewport.addEventListener('scroll', onScroll, { passive: true });
    const stopInput = listenUserInput({ root: inputRoot, ...userInput });
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      stopInput();
    };
  }, [scrollerRef, onScroll, userInput]);

  const { suspend: suspendAnchor } = useScrollAnchor({
    viewportRef: scrollerRef,
    rowSelector: TRANSCRIPT_ROW_SELECTOR,
    shouldHold: isHolding,
    onRowMeasured: rowHeightCache.write,
  });

  const onSelectRun = (runId: ProviderRunId) => {
    suspendAnchor();
    document
      .querySelector(`[data-run-column="${runId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openDrawer = useAppStore((s) => s.openDrawer);
  const handleOpenDiff = useCallback(
    (filePath: string) => {
      if (diffWorktreePath == null || isBranchless) {
        return;
      }
      openDrawer({
        kind: 'file-diff',
        sessionId: session.id,
        payload: { source: { kind: 'worktree', worktreePath: diffWorktreePath }, path: filePath },
      });
    },
    [diffWorktreePath, isBranchless, openDrawer, session.id],
  );
  const handleRefreshAuth = useCallback(() => {
    void refreshProviders();
  }, [refreshProviders]);
  const handleRetryRun = useCallback(
    async ({ runId, model }: RetryRunParams) => {
      if (selectedAgentId == null) {
        return;
      }
      const source = findRetrySource({ events, runId });
      if (source == null) {
        return;
      }
      setRetryingRunId(runId);
      try {
        const { inputs: attachments, missing } = await readRetryAttachments({
          worktreePath,
          attachments: source.attachments,
        });
        if (missing.length > 0) {
          showToast({ kind: 'warning', message: missingAttachmentsMessage({ missing }) });
        }
        const override = buildRetryOverride({
          provider: source.provider,
          model: model ?? source.model,
        });
        await sendTurn({
          sessionId: session.id,
          agentId: selectedAgentId,
          content: source.content,
          ...(attachments.length > 0 ? { attachments } : {}),
          ...(override !== undefined ? { override } : {}),
        });
      } catch (error) {
        if (!isReportedError(error)) {
          void reportError({ title: "Couldn't retry the turn", error, sessionId: session.id });
        }
      } finally {
        setRetryingRunId(null);
      }
    },
    [events, reportError, selectedAgentId, sendTurn, session.id, showToast, worktreePath],
  );

  const mountProposals = useTranscriptMountProposals({ session });
  const mountProposalActions = useMountProposalActions({ sessionId: session.id });
  const loadSessionEvents = useAppStore((s) => s.loadSessionEvents);

  useEffect(() => {
    if (loadSessionEvents == null) {
      return;
    }
    void loadSessionEvents({ sessionId: session.id });
  }, [loadSessionEvents, session.id]);

  const mountSuggestionsByRun = useMemo(() => {
    const nodes = new Map<ProviderRunId, ReactNode>();
    for (const [runId, proposals] of mountProposalsByRun({ proposals: mountProposals })) {
      nodes.set(
        runId,
        <div className="flex min-w-0 flex-col gap-2">
          {proposals.map((proposal) => (
            <MountSuggestionCard
              key={proposal.projectId}
              projectName={proposal.projectName}
              agentName={
                phaseRuns.find((run) => run.id === proposal.agentId)?.name ?? 'the requesting agent'
              }
              reason={proposal.reason}
              cause={proposal.cause}
              onMount={() =>
                mountProposalActions.mount({
                  projectId: proposal.projectId,
                  projectName: proposal.projectName,
                  reason: proposal.reason,
                })
              }
              onDismiss={() =>
                mountProposalActions.dismiss({
                  projectId: proposal.projectId,
                  projectName: proposal.projectName,
                  reason: proposal.reason,
                })
              }
            />
          ))}
        </div>,
      );
    }
    return nodes;
  }, [mountProposalActions, mountProposals, phaseRuns]);

  const answeredQuestions = useSessionAnsweredQuestions(session.id);
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  const loadSessionAnsweredQuestions = useAppStore((s) => s.loadSessionAnsweredQuestions);
  const openQuestionScrollTarget = useAppStore((s) => s.openQuestionScrollTarget);
  const clearOpenQuestionScroll = useAppStore((s) => s.clearOpenQuestionScroll);

  useEffect(() => {
    void loadSessionOpenQuestions(session.id);
  }, [session.id, loadSessionOpenQuestions]);

  useEffect(() => {
    void loadSessionAnsweredQuestions(session.id);
  }, [session.id, loadSessionAnsweredQuestions]);

  const slackDrafts = useSessionSlackDrafts(session.id);
  const loadSessionSlackDrafts = useAppStore((s) => s.loadSessionSlackDrafts);

  useEffect(() => {
    void loadSessionSlackDrafts(session.id);
  }, [session.id, loadSessionSlackDrafts]);

  const oqByTurnOrdinal = useMemo(() => {
    const map = new Map<number | null, OpenQuestion[]>();
    for (const q of [...openQuestions, ...answeredQuestions]) {
      if (q.createdByAgentId !== selectedAgentId) {
        continue;
      }
      const ordinal = q.turnOrdinal ?? null;
      const bucket = map.get(ordinal);
      if (bucket) {
        bucket.push(q);
      } else {
        map.set(ordinal, [q]);
      }
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return map;
  }, [openQuestions, answeredQuestions, selectedAgentId]);

  const waitingHere = useMemo(
    () =>
      openQuestions.filter(
        (question) => question.status === 'open' && question.createdByAgentId === selectedAgentId,
      ),
    [openQuestions, selectedAgentId],
  );

  const resolveAttempts = useAppStore((s) => s.sessionResolveAttempts?.[session.id] ?? EMPTY_ARRAY);
  const resolverAgentIds = useMemo(
    () => new Set<string>(resolveAttempts.map((attempt) => attempt.agentId)),
    [resolveAttempts],
  );
  const isResolverChat = selectedAgentId != null && resolverAgentIds.has(selectedAgentId);
  const otherAgentQuestion = useMemo(
    () =>
      isResolverChat
        ? null
        : (openQuestions.find(
            (question) =>
              question.createdByAgentId != null &&
              question.createdByAgentId !== selectedAgentId &&
              !resolverAgentIds.has(question.createdByAgentId),
          ) ?? null),
    [isResolverChat, openQuestions, resolverAgentIds, selectedAgentId],
  );
  const otherAgentQuestionCount = useMemo(() => {
    if (otherAgentQuestion?.createdByAgentId == null) {
      return 0;
    }
    return openQuestions.filter(
      (question) => question.createdByAgentId === otherAgentQuestion.createdByAgentId,
    ).length;
  }, [openQuestions, otherAgentQuestion]);
  const otherAgentName =
    phaseRuns.find((run) => run.id === otherAgentQuestion?.createdByAgentId)?.name ??
    'another agent';
  const otherAgentId = otherAgentQuestion?.createdByAgentId ?? null;

  useEffect(() => {
    const target = openQuestionScrollTarget;
    if (!target || target.agentId !== selectedAgentId || transcriptStale) {
      return;
    }
    const node = document.querySelector(`[data-oq-anchor="${target.questionId}"]`);
    if (node) {
      suspendAnchor();
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      clearOpenQuestionScroll();
      return;
    }
    let hasOrdinalBearing = false;
    for (const cards of oqByTurnOrdinal.values()) {
      if (cards.some((q) => q.id === target.questionId)) {
        hasOrdinalBearing = true;
        break;
      }
    }
    if (hasOrdinalBearing) {
      return;
    }
    const el = scrollerRef.current;
    if (el) {
      suspendAnchor();
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
    clearOpenQuestionScroll();
  }, [
    openQuestionScrollTarget,
    selectedAgentId,
    deferredItems,
    transcriptStale,
    oqByTurnOrdinal,
    clearOpenQuestionScroll,
    scrollerRef,
    suspendAnchor,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={fadeHostRef} className="relative flex min-h-0 flex-1 flex-col">
        <ScrollFade
          className="flex-1"
          fadeSize="h-12"
          viewportClassName={cn('pb-4', topInset === 'tight' ? 'pt-2' : 'pt-6')}
        >
          <ConversationColumn className="h-full">
            {transcriptStale || (loading.transcript && deferredItems.length === 0) ? (
              <TranscriptSkeleton />
            ) : deferredItems.length === 0 &&
              oqByTurnOrdinal.size === 0 &&
              slackDrafts.length === 0 &&
              isProviderDisconnected ? (
              <div className="flex h-full items-center justify-center">
                <div>
                  <AuthRequiredCallout
                    providerId={provider}
                    identity={providerIdentity}
                    onRefresh={() => void refreshProviders()}
                  />
                </div>
              </div>
            ) : deferredItems.length === 0 &&
              oqByTurnOrdinal.size === 0 &&
              slackDrafts.length === 0 &&
              (insertions ?? []).length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <ChatEmptyState
                  sessionId={session.id}
                  selectedAgentId={selectedAgentId}
                  phaseRuns={phaseRuns}
                  hasWorkflow={session.workflowRuns.length > 0}
                />
              </div>
            ) : (
              <ul data-find-root data-scroll-content="" className={PANE_RHYTHM.transcript.turns}>
                <ChatImageLoaderProvider key={session.id} sessionId={session.id}>
                  <TranscriptRows
                    rows={rows}
                    newFromKey={newFromKey}
                    oqByTurnOrdinal={oqByTurnOrdinal}
                    slackDrafts={slackDrafts}
                    sessionId={session.id}
                    selectedAgentId={selectedAgentId}
                    workingDir={worktreePath}
                    onRefreshAuth={handleRefreshAuth}
                    onOpenDiff={handleOpenDiff}
                    isThinking={isThinking}
                    thinkingPhrase={thinkingPhrase}
                    thinkingStartedAt={thinkingStartedAt}
                    onRetryRun={(params) => void handleRetryRun(params)}
                    retryingRunId={retryingRunId}
                    mountSuggestionsByRun={mountSuggestionsByRun}
                    activeRunId={activeRunId}
                    turnFooters={turnFooters}
                    briefLabel={briefLabel}
                    {...(insertions !== undefined && { insertions })}
                    {...(onOpenTranscript !== undefined && { onOpenTranscript })}
                    isStepsOnly={mode === 'steps'}
                    waitingFor={waitingFor}
                    {...(stopLabel !== undefined && { stopLabel })}
                    {...(clockStepAgentId !== undefined && { clockStepAgentId })}
                    stopPhase={agentStop.phase}
                    {...(canStop && { onStop: agentStop.stop })}
                  />
                </ChatImageLoaderProvider>
              </ul>
            )}
          </ConversationColumn>
        </ScrollFade>
        {!pinned && waitingHere[0] !== undefined && (
          <QuestionWaitingPill count={waitingHere.length} questionId={waitingHere[0].id} />
        )}
        <JumpToLatest
          isVisible={!pinned && waitingHere.length === 0}
          onJump={() => {
            suspendAnchor();
            jumpToLatest();
          }}
        />
      </div>
      {hasComposer &&
      selectedAgentId != null &&
      otherAgentQuestion != null &&
      otherAgentId != null &&
      otherAgentQuestionCount > 0 ? (
        <OtherAgentQuestionButton
          sessionId={session.id}
          agentId={otherAgentId}
          agentName={otherAgentName}
          questionId={otherAgentQuestion.id}
          count={otherAgentQuestionCount}
        />
      ) : null}
      {hasAdvanceRow && hasComposer && !isEnded && selectedAgentId != null ? (
        <WorkflowAdvanceStack session={session} />
      ) : null}
      {hasComposer && !isEnded && selectedAgentId != null && composerLead !== undefined ? (
        <ConversationColumn className="py-1">{composerLead}</ConversationColumn>
      ) : null}
      {!hasComposer ? (
        composerNotice === undefined ? null : (
          <ConversationColumn className="py-3">{composerNotice}</ConversationColumn>
        )
      ) : isEnded ? (
        agentQuestionCount > 0 ? null : (
          <ConversationColumn className="py-3 text-meta text-muted-foreground">
            Session ended. No more turns run here, and the branch is kept.
          </ConversationColumn>
        )
      ) : selectedAgentId ? (
        <ChatInput
          key={agentId === undefined ? session.id : `${session.id}:${agentId}`}
          session={session}
          agentId={agentId}
          providerDisconnected={isProviderDisconnected}
          placeholderOverride={composerPlaceholder}
          {...(controlSlots !== undefined && { controlSlots })}
        />
      ) : null}
    </div>
  );
};
