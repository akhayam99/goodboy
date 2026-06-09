import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { ArrowDown, Sparkles } from 'lucide-react';
import { DogMascot } from '../../../../shared/components/DogMascot';
import agentDebugger from '../../../../assets/agents/debugger.png';
import agentDocs from '../../../../assets/agents/docs.png';
import agentGoodboy from '../../../../assets/agents/goodboy.png';
import agentImplementer from '../../../../assets/agents/implementer.png';
import agentPlanner from '../../../../assets/agents/planner.png';
import agentReviewer from '../../../../assets/agents/reviewer.png';
import agentScout from '../../../../assets/agents/scout.png';
import agentTester from '../../../../assets/agents/tester.png';
import {
  AGENT_KIND_META,
  inferAgentKindFromName,
  type AgentKind as AgentKindLabel,
} from '../../../session/agent-kind';
import type { AgentId, ProviderRunId, Session } from '@goodboy/types';
import { cn, Divider, Skeleton } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore, useSessionLoading, useTranscript } from '../../../../store';
import {
  detectParallelRunIds,
  filterEventsByRunId,
  reduceTranscript,
} from '../../utils/transcript-items';
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

type ChatViewProps = {
  session: Session;
  isActive?: boolean;
};

const PIN_TOLERANCE_PX = 32;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function useScrollPin(deps: ReadonlyArray<unknown>, resetKey?: unknown) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    setPinned(true);
  }, [resetKey]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [pinned, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < PIN_TOLERANCE_PX);
    setAtTop(el.scrollTop < PIN_TOLERANCE_PX);
  };

  return { scrollerRef, pinned, atTop, onScroll };
}

type ColumnProps = {
  runId: ProviderRunId;
  index: number;
  events: ReturnType<typeof useTranscript>;
  workingDir: string | null;
  onRefreshAuth: () => void;
  onOpenDiff: (filePath: string) => void;
};

function ParallelColumn({
  runId,
  index,
  events,
  workingDir,
  onRefreshAuth,
  onOpenDiff,
}: ColumnProps) {
  const columnEvents = useMemo(() => filterEventsByRunId(events, runId), [events, runId]);
  const items = useMemo(() => reduceTranscript(columnEvents), [columnEvents]);
  const { scrollerRef, pinned, onScroll } = useScrollPin([items]);

  return (
    <div
      data-run-column={runId}
      className="flex min-w-0 flex-col border-r border-border last:border-r-0"
    >
      <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
        p{index + 1}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollerRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">no events yet for run p{index + 1}.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((item) => (
                <li key={item.key}>
                  <TranscriptCard
                    item={item}
                    workingDir={workingDir}
                    onRefreshAuth={onRefreshAuth}
                    onOpenDiff={onOpenDiff}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        {!pinned ? (
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
        ) : null}
      </div>
    </div>
  );
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays > 0 && diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase();
  }
  return d
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    .toLowerCase();
}

function TranscriptSkeleton() {
  return (
    <div
      role="status"
      aria-label="loading transcript"
      className="mx-auto flex w-full max-w-[880px] flex-col gap-6"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export const ChatView = ({ session, isActive = true }: ChatViewProps) => {
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[session.id] ?? null,
  ) as AgentId | null;
  const events = useTranscript(selectedAgentId);
  const items = useMemo(() => reduceTranscript(events), [events]);
  // Defer the heavy transcript list so React 18 can paint header / input /
  // empty shell first on session switch and treat the card list as low-priority.
  // Pairs with React.memo on TranscriptCard, together they make session swaps
  // feel instant even with hundreds of turns in history.
  // Tag the deferred value with its agent id: useDeferredValue keeps returning
  // the previous agent's array for a render or more after a switch, without
  // the tag the list below would paint the wrong agent's transcript. While it
  // lags (`transcriptStale`) we render the skeleton instead.
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

  // Lazy transcript load: only fires when this view is the active one. With
  // keep-alive, hidden ChatView instances stay mounted but must not preload
  // transcripts in the background, that would defeat the lazy DB savings.
  useEffect(() => {
    if (!isActive || !selectedAgentId || transcriptCached) return;
    void selectAgent(session.id, selectedAgentId);
  }, [isActive, selectedAgentId, transcriptCached, selectAgent, session.id]);

  // Passive viewed-stamping: covers cases where the user watches an agent
  // finish in place, or revisits a session whose transcript is already cached.
  // selectAgent only fires on click/load, missing those two paths.
  useEffect(() => {
    if (!isActive || !selectedAgentId || !selectedAgentLastFinishedAt) return;
    if (selectedAgentLastViewedAt && selectedAgentLastViewedAt >= selectedAgentLastFinishedAt)
      return;
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
  // Subscribe only to the flag we need, `s.settings` is a wide map and any
  // setting write re-renders the whole chat view (and its transcript) if we
  // pull the entire object.
  const flagOn = useAppStore((s) => s.settings['experimental.enable_parallel_agents'] === 'true');
  const { scrollerRef, pinned, atTop, onScroll } = useScrollPin([deferredItems], selectedAgentId);

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
  const sessionWorkflows = useAppStore((s) => s.sessionWorkflows[session.id] ?? EMPTY_ARRAY);
  const rawMergeConflicts = useAppStore((s) => s.sessionMergeConflicts[session.id] ?? EMPTY_ARRAY);
  const resolveMergeConflicts = useAppStore((s) => s.resolveMergeConflicts);

  const allParallelTerminal = useMemo(() => {
    if (parallelRunIds.length === 0) return false;
    return parallelRunIds.every((rid) => {
      const run = phaseRuns.find((r) => r.runId === rid);
      return run ? TERMINAL_STATUSES.has(run.status) : false;
    });
  }, [parallelRunIds, phaseRuns]);

  const isSplitView = flagOn && parallelRunIds.length > 1;

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

  // Stable refs so React.memo on TranscriptCard short-circuits identity checks.
  const handleOpenDiff = useCallback((filePath: string) => {
    setDiffJumpFile(filePath);
  }, []);
  const handleRefreshAuth = useCallback(() => {
    void refreshProviders();
  }, [refreshProviders]);

  // Derive MergeConflict[] from store, populated by parallel-turn scheduler
  // when manual resolution is required. Cast FileConflict to MergeConflict:
  // both have {file, runIds}, the shapes are structurally identical.
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
      if (!run.runId) continue;
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
    // Filter out SKIP_SENTINEL picks, those files stay unresolved (winner's version kept).
    const resolvedPicks: Record<string, string> = {};
    for (const [file, pick] of Object.entries(picks)) {
      if (pick !== '__skip__') resolvedPicks[file] = pick;
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
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2">
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
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-background to-transparent transition-opacity duration-200',
            atTop ? 'opacity-0' : 'opacity-100',
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-background to-transparent" />
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-6 pb-4 pt-6"
          style={{ scrollbarGutter: 'stable' }}
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
            ) : (
              <div className="flex h-full items-center justify-center">
                <ChatEmptyState
                  selectedAgentId={selectedAgentId}
                  phaseRuns={phaseRuns}
                  hasWorkflow={session.workflowRuns.length > 0}
                />
              </div>
            )
          ) : (
            <ul
              className="mx-auto flex w-full max-w-[880px] flex-col"
              aria-live="polite"
              aria-relevant="additions"
            >
              {(() => {
                let lastDay: string | null = null;
                return rows.map((row, idx) => {
                  const node: React.ReactNode[] = [];
                  let isTurnBreak = false;
                  if (row.kind === 'item' && row.item.kind === 'user_text') {
                    const at = row.item.at;
                    const day = dayKey(at);
                    const dayChanged = day !== lastDay;
                    // Divider marks the boundary between turns; on a day change
                    // the date pill already separates them, so skip it there.
                    if (idx > 0 && !dayChanged) {
                      isTurnBreak = true;
                      node.push(
                        <li key={`turn-${row.key}`} className="my-2.5">
                          <Divider />
                        </li>,
                      );
                    }
                    if (dayChanged) {
                      node.push(
                        <li key={`day-${day}-${idx}`} className="my-2.5 flex justify-center">
                          <span className="rounded-full border border-border-soft bg-background px-2 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
                            {formatDayLabel(at)}
                          </span>
                        </li>,
                      );
                      lastDay = day;
                    }
                  }
                  const itemSpacing = idx === 0 || isTurnBreak ? '' : 'mt-2.5';
                  node.push(
                    <li
                      key={row.key}
                      className={cn(
                        itemSpacing,
                        // Browser-native virtualization: skip layout/paint of
                        // off-screen cards. The `auto` keyword makes the engine
                        // remember each card's last-rendered height as its
                        // placeholder, so scrolling back up doesn't jump (the
                        // 80px seed only applies to never-yet-painted cards).
                        // With 100+ turns, scroll stays smooth, no virtualizer dep.
                        '[content-visibility:auto] [contain-intrinsic-size:auto_80px]',
                      )}
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
                  return node;
                });
              })()}
              {isThinking ? (
                <li className="mt-2.5">
                  <ThinkingIndicator context={thinkingContext} />
                </li>
              ) : null}
            </ul>
          )}
        </div>
        {!pinned ? (
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
        ) : null}
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

type ChatEmptyStateProps = {
  selectedAgentId: AgentId | null;
  phaseRuns: ReadonlyArray<import('@goodboy/types').Agent>;
  hasWorkflow: boolean;
};

function ChatEmptyState({ selectedAgentId, phaseRuns, hasWorkflow }: ChatEmptyStateProps) {
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const selectedAgent = useMemo(
    () => (selectedAgentId ? (phaseRuns.find((r) => r.id === selectedAgentId) ?? null) : null),
    [selectedAgentId, phaseRuns],
  );
  const selectedKind = useMemo(() => {
    if (!selectedAgent) return null;
    return agentKindOverride[selectedAgent.id] ?? inferAgentKindFromName(selectedAgent.name);
  }, [selectedAgent, agentKindOverride]);

  const scenario = useMemo<EmptyScenario>(() => {
    if (selectedAgent && selectedKind) return 'agent_focus';
    if (phaseRuns.length > 0) return 'pick_agent';
    if (hasWorkflow) return 'workflow_no_agent';
    return 'fresh';
  }, [selectedAgent, selectedKind, phaseRuns.length, hasWorkflow]);

  const copy = useMemo<EmptyCopy>(() => {
    switch (scenario) {
      case 'agent_focus': {
        const meta = AGENT_KIND_META[selectedKind as AgentKindLabel];
        return {
          eyebrow: `${meta.label} agent · fresh transcript`,
          title: `You're talking to a ${meta.label} agent`,
          body: `${meta.hint}. It already knows the session brief on the right: goal, decisions, open questions. No need to re-explain. Say what you want next.`,
          hints: [
            selectedKind === 'scout' ? 'Try: "find where X is defined"' : null,
            selectedKind === 'planner' ? 'Try: "plan how to add X to Y"' : null,
            selectedKind === 'implementer' ? 'Try: "implement step 2 of the plan"' : null,
            selectedKind === 'debugger' ? 'Try: "reproduce: <stack trace>"' : null,
            selectedKind === 'tester' ? 'Try: "write tests for X"' : null,
            selectedKind === 'reviewer' ? 'Try: "review the current diff"' : null,
            selectedKind === 'resolver' ? 'Spawned automatically by the resolve UI.' : null,
            '⌘↵ to send',
          ].filter((x): x is string => Boolean(x)),
        };
      }
      case 'pick_agent':
        return {
          eyebrow: `${phaseRuns.length === 1 ? 'agent' : 'agents'} in this session`,
          title: 'Pick an agent on the left',
          body: 'Agents share the session context on the right. Every new one starts already knowing the goal, decisions and open questions. Only the chat history is per-agent. Pick one to keep talking, or spawn a new one: it will hit the ground running.',
          hints: ['Select an agent to see its transcript', 'Spawn fresh, context travels with it'],
        };
      case 'workflow_no_agent':
        return {
          eyebrow: 'Workflow ready · No agents yet',
          title: 'Start the first step',
          body: 'No agents have run yet. Write here to shape the session brief on the right: goal, constraints, anything important. The first agent, and every one after, will start already knowing it.',
          hints: ['Describe the goal in 1–2 lines', 'Lands in the shared context'],
        };
      case 'fresh':
      default:
        return {
          eyebrow: 'Fresh session · No context yet',
          title: "Let's populate the context",
          body: "Whatever you write here feeds the shared session brief on the right: goal, decisions, open questions. Every agent you spawn from now on starts already knowing the essentials, so you don't repeat yourself.",
          hints: [
            'What are we building',
            'Any constraints or non-goals',
            'Who should the first agent be',
          ],
        };
    }
  }, [scenario, selectedKind, phaseRuns.length]);

  const agentVisual = scenario === 'agent_focus' && selectedKind ? KIND_ICON[selectedKind] : null;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex items-center justify-center">
        {agentVisual?.image ? (
          <MaskedDog image={agentVisual.image} className={cn('size-32', agentVisual.tint)} />
        ) : scenario === 'pick_agent' ? (
          <span className="text-7xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {phaseRuns.length}
          </span>
        ) : (
          <DogMascot size={128} className="text-primary" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          {copy.eyebrow}
        </span>
        <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-2xs text-muted-foreground/70">
        {copy.hints.map((hint) => (
          <span
            key={hint}
            className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-background px-2 py-0.5 text-2xs"
          >
            <Sparkles size={10} aria-hidden />
            {hint}
          </span>
        ))}
      </div>
    </div>
  );
}

function MaskedDog({ image, className }: { image: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('shrink-0', className)}
      style={{
        maskImage: `url(${image})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: `url(${image})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
    />
  );
}

type EmptyScenario = 'fresh' | 'workflow_no_agent' | 'pick_agent' | 'agent_focus';

type KindVisual = {
  image: string | null;
  tint: string;
};

const KIND_ICON: Record<AgentKindLabel, KindVisual> = {
  generic: {
    image: agentGoodboy,
    tint: 'bg-rose-400',
  },
  scout: {
    image: agentScout,
    tint: 'bg-sky-400',
  },
  planner: {
    image: agentPlanner,
    tint: 'bg-violet-400',
  },
  implementer: {
    image: agentImplementer,
    tint: 'bg-emerald-400',
  },
  debugger: {
    image: agentDebugger,
    tint: 'bg-amber-400',
  },
  tester: {
    image: agentTester,
    tint: 'bg-teal-400',
  },
  reviewer: {
    image: agentReviewer,
    tint: 'bg-cyan-400',
  },
  docs: {
    image: agentDocs,
    tint: 'bg-orange-400',
  },
  resolver: {
    image: null,
    tint: 'bg-lime-400',
  },
};

type EmptyCopy = {
  eyebrow: string;
  title: string;
  body: string;
  hints: ReadonlyArray<string>;
};
