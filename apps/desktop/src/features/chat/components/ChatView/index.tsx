import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowDown } from 'lucide-react';
import type { AgentId, OpenQuestion, ProviderRunId, Session } from '@goodboy/types';
import { Divider, ScrollFade } from '@goodboy/ui';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionLoading,
  useSessionOpenQuestions,
  useTranscript,
} from '../../../../store';
import { detectParallelRunIds, reduceTranscript } from '../../utils/transcript-items';
import { clusterOperations } from '../../utils/cluster-operations';
import { classifyThinkingContext } from '../../utils/thinking-context';
import { ThinkingIndicator } from '../ThinkingIndicator';
import { TranscriptCard } from '../TranscriptCards';
import { OperationsCluster } from '../OperationsCluster';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { ChatBreadcrumb } from '../ChatBreadcrumb';
import { ChatInput } from '../ChatInput';
import {
  MergeDialog,
  type MergeConflict,
  type MergeResolution,
  type RunMeta,
} from '../../../../features/permissions/components/MergeDialog';
import { DiffViewerDialog } from '../../../../features/permissions/components/DiffViewerDialog';
import { worktreeDiff } from '../../../../features/worktree/worktree';
import { OpenQuestionCluster } from './OpenQuestionCluster';
import { ChatEmptyState } from './ChatEmptyState';
import { ClusterProgressDashboard } from './ClusterProgressDashboard';
import { selectClusterDashboard } from './clusterDashboard';
import { ParallelColumn } from './ParallelColumn';
import { useScrollPin } from './useScrollPin';
import { dayKey, formatDayLabel } from './lib';
import { MARKER_ACCENT } from '../marker-accents';

const neutralAccent = MARKER_ACCENT.neutral;
import { TranscriptSkeleton } from './parts/TranscriptSkeleton';

type ChatViewProps = {
  session: Session;
  isActive?: boolean;
};

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export const ChatView = ({ session, isActive = true }: ChatViewProps) => {
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[session.id] ?? null,
  ) as AgentId | null;
  const events = useTranscript(selectedAgentId);
  const items = useMemo(() => reduceTranscript(events), [events]);
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
  const selectAgent = useAppStore((s) => s.selectAgent);
  const advanceClusterImplementation = useAppStore((s) => s.advanceClusterImplementation);
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
    void selectAgent(session.id, selectedAgentId);
  }, [isActive, selectedAgentId, transcriptCached, selectAgent, session.id]);

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
  const authResults = useAppStore((s) => s.authResults);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const flagOn = useAppStore((s) => s.settings['experimental.enable_parallel_agents'] === 'true');
  const { scrollerRef, pinned, onScroll } = useScrollPin([deferredItems], selectedAgentId);
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
  const lastItem = items[items.length - 1];
  const lastRow = rows[rows.length - 1];
  const lastClusterRunning =
    lastRow?.kind === 'operations' && lastRow.items.some((i) => i.kind === 'tool_call' && !i.ended);
  const isThinking =
    agentKind === 'running' &&
    (lastItem?.kind ?? 'user_text') !== 'assistant_text' &&
    !lastClusterRunning;
  const thinkingContext = useMemo(() => classifyThinkingContext({ lastItem }), [lastItem]);

  const parallelRunIds = useMemo<ReadonlyArray<ProviderRunId>>(
    () => (flagOn ? detectParallelRunIds(events) : []),
    [events, flagOn],
  );

  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const sessionPlans = useAppStore((s) => s.sessionPlans[session.id] ?? EMPTY_ARRAY);
  const agentTurnState = useAppStore(useShallow((s) => s.agentTurnState));
  const sessionWorkflows = useAppStore((s) => s.sessionWorkflows[session.id] ?? EMPTY_ARRAY);

  const clusterDashboard = useMemo(() => {
    const base = selectClusterDashboard(phaseRuns, selectedAgentId ?? undefined, sessionPlans);
    if (!base) {
      return null;
    }
    const items = base.items.map((item) =>
      agentTurnState[item.agent.id]?.kind === 'running' && item.agent.status !== 'running'
        ? { ...item, agent: { ...item.agent, status: 'running' as const } }
        : item,
    );
    return { ...base, items };
  }, [phaseRuns, selectedAgentId, sessionPlans, agentTurnState]);
  const rawMergeConflicts = useAppStore((s) => s.sessionMergeConflicts[session.id] ?? EMPTY_ARRAY);
  const resolveMergeConflicts = useAppStore((s) => s.resolveMergeConflicts);

  const allParallelTerminal = useMemo(() => {
    if (parallelRunIds.length === 0) {
      return false;
    }
    return parallelRunIds.every((rid) => {
      const run = phaseRuns.find((r) => r.runId === rid);
      return run ? TERMINAL_STATUSES.has(run.status) : false;
    });
  }, [parallelRunIds, phaseRuns]);

  const isSplitView = flagOn && parallelRunIds.length > 1;

  useLayoutEffect(() => {
    if (isSplitView) {
      return;
    }
    const viewport = fadeHostRef.current?.querySelector<HTMLDivElement>('.overflow-y-auto');
    if (!viewport) {
      return;
    }
    scrollerRef.current = viewport;
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [scrollerRef, onScroll, isSplitView]);

  const onSelectRun = (runId: ProviderRunId) => {
    document
      .querySelector(`[data-run-column="${runId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [diffJumpFile, setDiffJumpFile] = useState<string | null>(null);
  const diffLoader = useMemo(
    () => (worktreePath ? () => worktreeDiff(worktreePath) : undefined),
    [worktreePath],
  );

  const handleOpenDiff = useCallback((filePath: string) => {
    setDiffJumpFile(filePath);
  }, []);
  const handleRefreshAuth = useCallback(() => {
    void refreshProviders();
  }, [refreshProviders]);

  const openQuestions = useSessionOpenQuestions(session.id);
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

  const oqByTurnOrdinal = useMemo(() => {
    const map = new Map<number, OpenQuestion[]>();
    for (const q of [...openQuestions, ...answeredQuestions]) {
      if (q.createdByAgentId !== selectedAgentId || q.turnOrdinal == null) {
        continue;
      }
      const bucket = map.get(q.turnOrdinal);
      if (bucket) {
        bucket.push(q);
      } else {
        map.set(q.turnOrdinal, [q]);
      }
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return map;
  }, [openQuestions, answeredQuestions, selectedAgentId]);

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

  const mergeConflicts = useMemo<ReadonlyArray<MergeConflict>>(
    () => rawMergeConflicts as ReadonlyArray<MergeConflict>,
    [rawMergeConflicts],
  );

  const mergeRunMeta = useMemo<ReadonlyMap<ProviderRunId, RunMeta>>(() => {
    const map = new Map<ProviderRunId, RunMeta>();
    const stepNameById = new Map<string, string>();
    for (const workflow of sessionWorkflows ?? EMPTY_ARRAY) {
      for (const step of workflow.steps) {
        stepNameById.set(step.id, step.name);
      }
    }
    for (const run of phaseRuns) {
      if (!run.runId) {
        continue;
      }
      const stepName = run.stepId ? stepNameById.get(run.stepId) : undefined;
      map.set(run.runId as ProviderRunId, {
        agentName: run.name,
        ...(stepName ? { stepName } : {}),
      });
    }
    return map;
  }, [phaseRuns, sessionWorkflows]);

  const terminalRunStatuses = useMemo(
    () =>
      phaseRuns
        .filter((r) => r.completedAt !== undefined && r.runId !== undefined)
        .map((r) => ({
          runId: r.runId as string,
          completedAt: r.completedAt as string,
          status: r.status,
        })),
    [phaseRuns],
  );

  const onMergeResolve = (picks: Record<string, MergeResolution>) => {
    const resolvedPicks: Record<string, string> = {};
    for (const [file, pick] of Object.entries(picks)) {
      if (pick !== '__skip__') {
        resolvedPicks[file] = pick;
      }
    }
    void resolveMergeConflicts(session.id, resolvedPicks, terminalRunStatuses);
    setMergeDialogOpen(false);
  };

  if (isSplitView) {
    return (
      <div className="flex h-full flex-col">
        <div
          className="flex-1 overflow-hidden"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${parallelRunIds.length}, minmax(0, 1fr))`,
          }}
        >
          {parallelRunIds.map((runId, i) => (
            <ParallelColumn
              key={runId}
              runId={runId}
              index={i}
              events={events}
              workingDir={worktreePath}
              onRefreshAuth={() => void refreshProviders()}
              onOpenDiff={handleOpenDiff}
            />
          ))}
        </div>
        {allParallelTerminal ? (
          <div
            className={`flex items-center justify-between border-t bg-muted/40 px-4 py-2 ${neutralAccent.border}`}
          >
            <span className="text-xs text-muted-foreground">merge pending. review conflicts</span>
            <button
              type="button"
              data-testid="merge-dialog-trigger"
              className="rounded border border-border bg-background px-3 py-1 text-xs motion-safe:transition-colors hover:bg-muted"
              onClick={() => setMergeDialogOpen(true)}
            >
              Merge
            </button>
          </div>
        ) : null}
        <MergeDialog
          open={mergeDialogOpen}
          conflicts={mergeConflicts}
          runMeta={mergeRunMeta}
          onResolve={onMergeResolve}
          onCancel={() => setMergeDialogOpen(false)}
        />
        {isEnded ? (
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            session ended. no further turns. branch preserved.
          </div>
        ) : (
          <ChatInput
            key={session.id}
            session={session}
            providerDisconnected={isProviderDisconnected}
          />
        )}
        <DiffViewerDialog
          open={diffJumpFile !== null}
          onClose={() => setDiffJumpFile(null)}
          sessionId={session.id}
          title="worktree diff"
          loader={diffLoader}
          workingDir={worktreePath ?? undefined}
          jumpToFile={diffJumpFile ?? undefined}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatBreadcrumb session={session} />
      <div ref={fadeHostRef} className="relative flex min-h-0 flex-1 flex-col">
        <ScrollFade
          className="flex-1"
          fadeSize="h-12"
          viewportClassName="px-6 pb-4 pt-6 [scrollbar-gutter:stable]"
        >
          {transcriptStale || deferredItems.length === 0 ? (
            loading.transcript || transcriptStale ? (
              <TranscriptSkeleton />
            ) : isProviderDisconnected ? (
              <div className="flex h-full items-center justify-center">
                <div className="mx-auto w-full max-w-[880px]">
                  <AuthRequiredCallout
                    providerId={provider}
                    identity={providerIdentity}
                    onRefresh={() => void refreshProviders()}
                  />
                </div>
              </div>
            ) : clusterDashboard ? (
              <ClusterProgressDashboard
                sessionId={session.id}
                items={clusterDashboard.items}
                completed={clusterDashboard.completed}
                total={clusterDashboard.total}
                selectedAgentId={selectedAgentId ?? undefined}
                onSelect={(id) => void selectAgent(session.id, id)}
                onAdvance={(id) =>
                  void advanceClusterImplementation(session.id, id, '', { force: true })
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ChatEmptyState
                  sessionId={session.id}
                  selectedAgentId={selectedAgentId}
                  phaseRuns={phaseRuns}
                  hasWorkflow={session.workflowRuns.length > 0}
                />
              </div>
            )
          ) : (
            <ul
              className="mx-auto flex w-full max-w-[880px] flex-col gap-2.5"
              aria-live="polite"
              aria-relevant="additions"
            >
              {(() => {
                const out: React.ReactNode[] = [];
                let lastDay: string | null = null;
                let userTurnOrdinal = 0;

                const flushOrdinal = (ordinal: number) => {
                  const cards = oqByTurnOrdinal.get(ordinal);
                  if (!cards || cards.length === 0) {
                    return;
                  }
                  out.push(
                    <li key={`oq-${ordinal}`}>
                      <OpenQuestionCluster questions={cards} sessionId={session.id} />
                    </li>,
                  );
                };

                rows.forEach((row, idx) => {
                  if (row.kind === 'item' && row.item.kind === 'oq_answer') {
                    flushOrdinal(userTurnOrdinal);
                    userTurnOrdinal += 1;
                    return;
                  }
                  if (row.kind === 'item' && row.item.kind === 'user_text') {
                    flushOrdinal(userTurnOrdinal);
                    userTurnOrdinal += 1;
                    const at = row.item.at;
                    const day = dayKey(at);
                    const dayChanged = day !== lastDay;
                    if (idx > 0 && !dayChanged) {
                      out.push(
                        <li key={`turn-${row.key}`}>
                          <Divider />
                        </li>,
                      );
                    }
                    if (dayChanged) {
                      out.push(
                        <li key={`day-${day}-${idx}`} className="flex justify-center">
                          <span className="rounded-full border border-border-soft bg-background px-2 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
                            {formatDayLabel(at)}
                          </span>
                        </li>,
                      );
                      lastDay = day;
                    }
                  }
                  out.push(
                    <li
                      key={row.key}
                      className="[content-visibility:auto] [contain-intrinsic-size:auto_80px]"
                    >
                      {row.kind === 'operations' ? (
                        <OperationsCluster
                          items={row.items}
                          sessionId={session.id}
                          agentId={selectedAgentId}
                          workingDir={worktreePath}
                          onRefreshAuth={handleRefreshAuth}
                          onOpenDiff={handleOpenDiff}
                        />
                      ) : (
                        <TranscriptCard
                          item={row.item}
                          sessionId={session.id}
                          agentId={selectedAgentId}
                          workingDir={worktreePath}
                          onRefreshAuth={handleRefreshAuth}
                          onOpenDiff={handleOpenDiff}
                        />
                      )}
                    </li>,
                  );
                });

                flushOrdinal(userTurnOrdinal);
                return out;
              })()}
              {isThinking ? (
                <li>
                  <ThinkingIndicator context={thinkingContext} />
                </li>
              ) : null}
            </ul>
          )}
        </ScrollFade>
        {!pinned && (
          <button
            type="button"
            aria-label="jump to latest"
            title="jump to latest"
            className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-background/90 ring-1 ring-border-soft transition-colors hover:bg-muted"
            onClick={() => {
              const el = scrollerRef.current;
              el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            }}
          >
            <ArrowDown size={14} aria-hidden />
          </button>
        )}
      </div>
      {isEnded ? (
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          session ended. no further turns. branch preserved.
        </div>
      ) : selectedAgentId ? (
        <ChatInput
          key={session.id}
          session={session}
          providerDisconnected={isProviderDisconnected}
        />
      ) : null}
      <DiffViewerDialog
        open={diffJumpFile !== null}
        onClose={() => setDiffJumpFile(null)}
        sessionId={session.id}
        title="worktree diff"
        loader={diffLoader}
        workingDir={worktreePath ?? undefined}
        jumpToFile={diffJumpFile ?? undefined}
      />
    </div>
  );
};
