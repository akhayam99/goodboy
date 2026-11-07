import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { AgentId, OpenQuestion, ProviderRunId, Session } from '@goodboy/types';
import { PANE_RHYTHM, ScrollFade, appScrollIntoView, appScrollTo } from '@goodboy/ui';
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
import { livePhraseOf } from '../../utils/livePhraseOf';
import { permissionFor, toolStatus } from '../../utils/toolStatus';
import { turnFootersFor } from '../../utils/turnOutcome';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { useProviderHealth } from '../../../../shared/hooks/useProviderHealth';
import { ChatInput } from '../ChatInput';
import { ConversationColumn } from '../ConversationColumn';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { MountSuggestionStack } from './parts/MountSuggestionStack';
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
import { TRANSCRIPT_FLOOR_PX, useScrollPin } from './useScrollPin';
import { anchorKeyOf } from './anchorKeyOf';
import { listenUserInput } from './listenUserInput';
import { useAskDock } from './useAskDock';
import { useTranscriptAnchor } from './useTranscriptAnchor';
import { TranscriptSkeleton } from './parts/TranscriptSkeleton';
import { WorkflowAdvanceStack } from './parts/WorkflowAdvanceStack';
import { QuestionWaitingPill } from './parts/QuestionWaitingPill';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { useDockFailure } from './useDockFailure';
import { useRetryRun } from './useRetryRun';
import { isTurnThinking } from '../../utils/isTurnThinking';
import { turnStateOf } from './turnStateOf';
import { waitingForOf } from './waitingForOf';
import { useTurnEndAnnouncement } from './useTurnEndAnnouncement';
import type { OpenTranscriptAt } from '../../openTranscriptAt';
import type { ComposerControlSlots } from '../ChatInput/composerControlSlots';
import type { ConversationStop } from '../../../../shared/types/conversationStop';

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
  readonly liveSentence?: string;
  readonly composerStop?: ConversationStop | null;
  readonly isFailureOwned?: boolean;
  readonly clockStepAgentId?: AgentId;
};

type ChatViewMode = 'conversation' | 'record' | 'steps';

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
  liveSentence,
  composerStop = null,
  isFailureOwned = false,
  clockStepAgentId,
}: Props) => {
  const storedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null) as AgentId | null;
  const selectedAgentId = agentId === undefined ? storedAgentId : agentId;
  const events = useTranscript(selectedAgentId);
  const items = useMemo(() => reduceTranscript(events), [events]);
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
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const selectedRun = phaseRuns.find((run) => run.id === selectedAgentId);
  const selectedAgentLastFinishedAt = selectedRun?.lastFinishedAt ?? null;
  const selectedAgentLastViewedAt = selectedRun?.lastViewedAt ?? null;

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
  const isTranscriptReady = !transcriptStale && transcriptCached && !loading.transcript;
  const anchorKey = useMemo(
    () => (isTranscriptReady ? anchorKeyOf({ items: deferredItems }) : undefined),
    [isTranscriptReady, deferredItems],
  );
  const { scrollerRef, tailRef, pinned, isBehind, onScroll, userInput, jumpToLatest, isHolding } =
    useScrollPin({
      deps: [deferredItems, agentQuestionCount],
      resetKey: selectedAgentId,
      anchorKey,
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
  const isAskInDock = isConversation && hasComposer && !isEnded && selectedAgentId != null;
  const askDock = useAskDock({
    sessionId: session.id,
    agentId: selectedAgentId,
    isAskInDock,
    isAskLapsed: selectedRun?.status === 'stopped',
  });
  const rows = useMemo(
    () =>
      isConversation
        ? conversationRows({ items: deferredItems, isLive: isTurnLive, askDock })
        : clusterOperations(deferredItems),
    [askDock, deferredItems, isConversation, isTurnLive],
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

  const { suspend: suspendAnchor } = useTranscriptAnchor({ scrollerRef, isHolding });

  const onSelectRun = (runId: ProviderRunId) => {
    suspendAnchor();
    const column = document.querySelector(`[data-run-column="${runId}"]`);
    appScrollIntoView({ element: column, behavior: 'smooth', block: 'start' });
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
  const { retryingRunId, retryRun } = useRetryRun({
    sessionId: session.id,
    agentId: selectedAgentId,
    events,
    worktreePath,
  });
  const { failure: dockFailure, errorDock } = useDockFailure({
    items,
    isInDock: isAskInDock,
    hasFailed: !isFailureOwned && (agentKind === 'error' || selectedRun?.status === 'failed'),
    retryingRunId,
    retry: retryRun,
  });
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
        <MountSuggestionStack
          proposals={proposals}
          phaseRuns={phaseRuns}
          actions={mountProposalActions}
        />,
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
      if (q.createdByAgentId !== selectedAgentId || (isAskInDock && q.status === 'open')) {
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
  }, [openQuestions, answeredQuestions, selectedAgentId, isAskInDock]);

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
      appScrollIntoView({ element: node, behavior: 'smooth', block: 'center' });
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
      appScrollTo({ viewport: el, top: el.scrollHeight, behavior: 'smooth' });
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
          viewportClassName={topInset === 'tight' ? 'pt-2' : 'pt-6'}
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
              <>
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
                      onRefreshAuth={() => void refreshProviders()}
                      onOpenDiff={handleOpenDiff}
                      isThinking={isThinking && !canStop}
                      thinkingPhrase={thinkingPhrase}
                      thinkingStartedAt={thinkingStartedAt}
                      onRetryRun={(params) => void retryRun(params)}
                      retryingRunId={retryingRunId}
                      mountSuggestionsByRun={mountSuggestionsByRun}
                      activeRunId={activeRunId}
                      turnFooters={turnFooters}
                      briefLabel={briefLabel}
                      {...(insertions !== undefined && { insertions })}
                      {...(onOpenTranscript !== undefined && { onOpenTranscript })}
                      isStepsOnly={mode === 'steps'}
                      errorDock={errorDock}
                      scrollerRef={scrollerRef}
                    />
                  </ChatImageLoaderProvider>
                </ul>
                <div
                  ref={tailRef}
                  aria-hidden
                  data-transcript-tail=""
                  style={{ height: TRANSCRIPT_FLOOR_PX }}
                />
              </>
            )}
          </ConversationColumn>
        </ScrollFade>
        {!isAskInDock && !pinned && mode !== 'steps' && waitingHere[0] !== undefined && (
          <QuestionWaitingPill count={waitingHere.length} questionId={waitingHere[0].id} />
        )}
        <JumpToLatest
          isVisible={isBehind && (isAskInDock || waitingHere.length === 0)}
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
          agentName={otherAgentName}
          questionId={otherAgentQuestion.id}
          count={otherAgentQuestionCount}
        />
      ) : null}
      {hasAdvanceRow && hasComposer && !isEnded && selectedAgentId != null ? (
        <WorkflowAdvanceStack session={session} />
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
          composerDock={{
            lead: composerLead,
            hasAsks: isAskInDock,
            live: {
              phrase: thinkingPhrase,
              startedAt: thinkingStartedAt,
              waitingFor,
              stepAgentId: clockStepAgentId ?? null,
            },
            stop: composerStop,
            stopLabel: stopLabel ?? null,
            liveSentence: liveSentence ?? null,
            failure: dockFailure,
          }}
          {...(controlSlots !== undefined && { controlSlots })}
        />
      ) : null}
    </div>
  );
};
