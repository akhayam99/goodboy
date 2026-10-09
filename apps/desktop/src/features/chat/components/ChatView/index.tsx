import type { RetryRunParams } from '../../retryRun';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { ArrowDown } from 'lucide-react';
import type {
  AgentId,
  MessageAttachment,
  OpenQuestion,
  ProviderId,
  ProviderRunId,
  Session,
  TurnEvent,
  TurnProviderOverride,
} from '@goodboy/types';
import { Button, cn, Divider, PageColumn, ScrollFade, Tooltip } from '@goodboy/ui';
import {
  EMPTY_ARRAY,
  agentPlace,
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionSlackDrafts,
  useTranscript,
} from '../../../../store';
import { reduceTranscript } from '../../utils/transcript-items';
import { clusterOperations } from '../../utils/cluster-operations';
import { classifyThinkingContext } from '../../utils/thinking-context';
import { permissionFor, toolStatus } from '../../utils/toolStatus';
import { turnFootersFor } from '../../utils/turnOutcome';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { ChatInput } from '../ChatInput';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { MountSuggestionCard } from '../MountSuggestionCard';
import { useTranscriptMountProposals } from '../../../suggestions/useTranscriptMountProposals';
import { useMountProposalActions } from '../../../suggestions/useMountProposalActions';
import { mountProposalsByRun } from '../../../suggestions/transcriptMountProposals';
import { ChatEmptyState } from './ChatEmptyState';
import { TranscriptRows } from './TranscriptRows';
import { ChatImageLoaderProvider } from './ChatImageLoaderProvider';
import { USER_SCROLL_EVENTS, useScrollPin } from './useScrollPin';
import { TranscriptSkeleton } from './parts/TranscriptSkeleton';
import { WorkflowAdvanceRow } from './parts/WorkflowAdvanceRow';
import { QuestionWaitingPill } from './parts/QuestionWaitingPill';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { missingAttachmentsMessage, readRetryAttachments } from './readRetryAttachments';
import { useToast } from '../../../../shared/components/Toast';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';

type Props = {
  readonly session: Session;
  readonly isActive?: boolean;
  readonly agentId?: AgentId | null;
  readonly topInset?: 'roomy' | 'tight';
  readonly hasComposer?: boolean;
};

type RetrySource = {
  readonly content: string;
  readonly attachments: ReadonlyArray<MessageAttachment>;
  readonly provider?: ProviderId;
  readonly model?: string;
};

type RetrySourceParams = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly runId: ProviderRunId;
};

type RetryOverrideParams = {
  readonly provider?: ProviderId;
  readonly model?: string;
};

const findRetrySource = ({ events, runId }: RetrySourceParams): RetrySource | null => {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.kind !== 'user_text') {
      continue;
    }
    if (event.runId !== runId) {
      continue;
    }
    return {
      content: event.text,
      attachments: event.attachments ?? [],
      provider: event.provider,
      model: event.model,
    };
  }
  return null;
};

const buildRetryOverride = ({
  provider,
  model,
}: RetryOverrideParams): TurnProviderOverride | undefined => {
  if (provider == null) {
    return undefined;
  }
  return {
    providerId: provider,
    ...(model != null ? { model } : {}),
  };
};

export const ChatView = ({
  session,
  isActive = true,
  agentId,
  topInset = 'roomy',
  hasComposer = true,
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
  const rows = useMemo(() => clusterOperations(deferredItems), [deferredItems]);
  const loading = useSessionLoading(session.id);
  const transcriptCached = useAppStore((s) =>
    selectedAgentId ? s.transcripts[selectedAgentId] !== undefined : true,
  );
  const loadAgentTranscript = useAppStore((s) => s.loadAgentTranscript);
  const navigate = useAppStore((s) => s.navigate);
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
  const { scrollerRef, pinned, onScroll, onUserScroll } = useScrollPin({
    deps: [deferredItems, agentQuestionCount],
    resetKey: selectedAgentId,
  });
  const fadeHostRef = useRef<HTMLDivElement>(null);

  const provider = session.providerPreference.defaultProvider;
  const providerAuthState = authResults?.[provider]?.state ?? null;
  const providerIdentity = authResults?.[provider]?.identity ?? null;
  const isProviderDisconnected = providerAuthState === 'disconnected';

  const agentState = useAppStore((s) => {
    return selectedAgentId ? (s.agentTurnState[selectedAgentId] ?? null) : null;
  });
  const agentKind = agentState?.kind ?? session.state.kind;
  const isEnded = agentKind === 'ended';
  const turnStateForRun = agentState ?? session.state;
  const activeRunId =
    turnStateForRun.kind === 'running' || turnStateForRun.kind === 'blocked'
      ? turnStateForRun.runId
      : null;
  const turnFooters = useMemo(() => turnFootersFor({ items, activeRunId }), [items, activeRunId]);
  const lastItem = items[items.length - 1];
  const lastRow = rows[rows.length - 1];
  const lastClusterRunning =
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
  const isThinking =
    agentKind === 'running' &&
    (lastItem?.kind ?? 'user_text') !== 'assistant_text' &&
    !lastClusterRunning;
  const thinkingContext = useMemo(() => classifyThinkingContext({ lastItem }), [lastItem]);

  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);

  useLayoutEffect(() => {
    const viewport = fadeHostRef.current?.querySelector<HTMLDivElement>('.overflow-y-auto');
    if (!viewport) {
      return;
    }
    scrollerRef.current = viewport;
    viewport.addEventListener('scroll', onScroll, { passive: true });
    for (const name of USER_SCROLL_EVENTS) {
      viewport.addEventListener(name, onUserScroll, { passive: true });
    }
    return () => {
      viewport.removeEventListener('scroll', onScroll);
      for (const name of USER_SCROLL_EVENTS) {
        viewport.removeEventListener(name, onUserScroll);
      }
    };
  }, [scrollerRef, onScroll, onUserScroll]);

  const onSelectRun = (runId: ProviderRunId) => {
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
  const requestOpenQuestionScroll = useAppStore((s) => s.requestOpenQuestionScroll);

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
  ]);

  return (
    <div className="flex h-full flex-col">
      <div ref={fadeHostRef} className="relative flex min-h-0 flex-1 flex-col">
        <ScrollFade
          className="flex-1"
          fadeSize="h-12"
          viewportClassName={cn('pb-4', topInset === 'tight' ? 'pt-2' : 'pt-6')}
        >
          <PageColumn className="h-full">
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
              slackDrafts.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <ChatEmptyState
                  sessionId={session.id}
                  selectedAgentId={selectedAgentId}
                  phaseRuns={phaseRuns}
                  hasWorkflow={session.workflowRuns.length > 0}
                />
              </div>
            ) : (
              <ul
                data-find-root
                className="flex flex-col gap-3"
                aria-live="polite"
                aria-relevant="additions"
              >
                <ChatImageLoaderProvider key={session.id} sessionId={session.id}>
                  <TranscriptRows
                    rows={rows}
                    oqByTurnOrdinal={oqByTurnOrdinal}
                    slackDrafts={slackDrafts}
                    sessionId={session.id}
                    selectedAgentId={selectedAgentId}
                    workingDir={worktreePath}
                    onRefreshAuth={handleRefreshAuth}
                    onOpenDiff={handleOpenDiff}
                    isThinking={isThinking}
                    thinkingContext={thinkingContext}
                    onRetryRun={(params) => void handleRetryRun(params)}
                    retryingRunId={retryingRunId}
                    mountSuggestionsByRun={mountSuggestionsByRun}
                    activeRunId={activeRunId}
                    turnFooters={turnFooters}
                  />
                </ChatImageLoaderProvider>
              </ul>
            )}
          </PageColumn>
        </ScrollFade>
        {!pinned && waitingHere[0] !== undefined && (
          <QuestionWaitingPill count={waitingHere.length} questionId={waitingHere[0].id} />
        )}
        {!pinned && waitingHere.length === 0 && (
          <Tooltip content="Jump to latest">
            <button
              type="button"
              aria-label="Jump to latest"
              className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-background ring-1 ring-border-soft transition-colors hover:bg-hover"
              onClick={() => {
                const el = scrollerRef.current;
                el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
              }}
            >
              <ArrowDown size={ICON_SIZE.control} aria-hidden />
            </button>
          </Tooltip>
        )}
      </div>
      {hasComposer &&
      selectedAgentId != null &&
      otherAgentQuestion != null &&
      otherAgentId != null &&
      otherAgentQuestionCount > 0 ? (
        <div className="flex shrink-0 justify-center py-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              navigate({ to: agentPlace({ sessionId: session.id, agentId: otherAgentId }) });
              requestOpenQuestionScroll({
                agentId: otherAgentId,
                questionId: otherAgentQuestion.id,
              });
            }}
          >
            {otherAgentQuestionCount}{' '}
            {otherAgentQuestionCount === 1 ? 'open question' : 'open questions'} from{' '}
            {otherAgentName}
          </Button>
        </div>
      ) : null}
      {hasComposer && !isEnded && selectedAgentId != null ? (
        <WorkflowAdvanceRow session={session} />
      ) : null}
      {!hasComposer ? null : isEnded ? (
        <>
          <Divider />
          <PageColumn className="py-3 text-label text-muted-foreground">
            Session ended. No more turns run here, and the branch is kept.
          </PageColumn>
        </>
      ) : selectedAgentId ? (
        <ChatInput
          key={session.id}
          session={session}
          providerDisconnected={isProviderDisconnected}
        />
      ) : null}
    </div>
  );
};
