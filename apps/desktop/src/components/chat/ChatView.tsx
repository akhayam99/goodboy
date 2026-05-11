import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProviderRunId, SessionId, Task } from '@kay-am/types';
import { cn } from '@kay-am/ui';
import { EMPTY_ARRAY, useAppStore, useTranscript } from '../../store';
import { detectParallelRunIds, filterEventsByRunId, reduceTranscript } from './transcript-items';
import { TranscriptCard } from './TranscriptCards';
import { AuthRequiredCallout } from './AuthRequiredCallout';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { MergeDialog, type MergeConflict, type MergeResolution } from './MergeDialog';

interface ChatViewProps {
  session: Task;
  onRequestEnd?: () => void;
}

const PIN_TOLERANCE_PX = 32;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function useScrollPin(deps: ReadonlyArray<unknown>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

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
  };

  return { scrollerRef, pinned, setPinned, onScroll };
}

interface ColumnProps {
  runId: ProviderRunId;
  index: number;
  events: ReturnType<typeof useTranscript>;
  onRefreshAuth: () => void;
}

function ParallelColumn({ runId, index, events, onRefreshAuth }: ColumnProps) {
  const columnEvents = useMemo(() => filterEventsByRunId(events, runId), [events, runId]);
  const items = useMemo(() => reduceTranscript(columnEvents), [columnEvents]);
  const { scrollerRef, pinned, setPinned, onScroll } = useScrollPin([items]);

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
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li key={item.key}>
                  <TranscriptCard item={item} onRefreshAuth={onRefreshAuth} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {!pinned ? (
          <button
            type="button"
            className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-background/95 px-3 py-1 text-xs shadow-md backdrop-blur-sm"
            onClick={() => {
              setPinned(true);
              const el = scrollerRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            jump to latest
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

function ThinkingIndicator() {
  return (
    <div
      role="status"
      aria-label="claude is thinking"
      className="flex w-fit items-center gap-1.5 px-1 py-0.5 text-2xs italic text-muted-foreground/80"
    >
      <span className="flex gap-0.5">
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
      </span>
      thinking
    </div>
  );
}

export function ChatView({ session }: ChatViewProps) {
  const selectedAgentId = useAppStore(
    (s) => s.selectedAgentId[session.id] ?? null,
  ) as SessionId | null;
  const events = useTranscript(selectedAgentId);
  const items = useMemo(() => reduceTranscript(events), [events]);
  const worktreePath = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const authResults = useAppStore((s) => s.authResults);
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const settings = useAppStore((s) => s.settings);
  const { scrollerRef, pinned, setPinned, onScroll } = useScrollPin([items]);

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
  const isThinking =
    agentKind === 'running' && (lastItem?.kind ?? 'user_text') !== 'assistant_text';

  const flagOn = settings['experimental.enable_parallel_agents'] === 'true';

  const parallelRunIds = useMemo<ReadonlyArray<ProviderRunId>>(
    () => (flagOn ? detectParallelRunIds(events) : []),
    [events, flagOn],
  );

  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
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

  // Derive MergeConflict[] from store — populated by parallel-turn scheduler
  // when manual resolution is required. Cast FileConflict to MergeConflict:
  // both have {file, runIds} — the shapes are structurally identical.
  const mergeConflicts = useMemo<ReadonlyArray<MergeConflict>>(
    () => rawMergeConflicts as ReadonlyArray<MergeConflict>,
    [rawMergeConflicts],
  );

  // Derive terminal runStatuses for the current session's phaseRuns.
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
    // Filter out SKIP_SENTINEL picks — those files stay unresolved (winner's version kept).
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
        <ChatHeader
          session={session}
          worktreePath={worktreePath}
          parallelRunIds={parallelRunIds}
          onSelectRun={onSelectRun}
        />
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
              onRefreshAuth={() => void refreshProviders()}
            />
          ))}
        </div>
        {allParallelTerminal ? (
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2">
            <span className="text-xs text-muted-foreground">merge pending — review conflicts</span>
            <button
              type="button"
              data-testid="merge-dialog-trigger"
              className="rounded border border-border bg-background px-3 py-1 text-xs motion-safe:transition-colors hover:bg-muted"
              onClick={() => setMergeDialogOpen(true)}
            >
              merge
            </button>
          </div>
        ) : null}
        <MergeDialog
          open={mergeDialogOpen}
          conflicts={mergeConflicts}
          onResolve={onMergeResolve}
          onCancel={() => setMergeDialogOpen(false)}
        />
        {isEnded ? (
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            session ended — no further turns. branch preserved.
          </div>
        ) : (
          <ChatInput session={session} providerDisconnected={isProviderDisconnected} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatHeader session={session} worktreePath={worktreePath} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-10 py-6"
          style={{ scrollbarGutter: 'stable' }}
        >
          {items.length === 0 ? (
            isProviderDisconnected ? (
              <div className="mx-auto w-full max-w-[880px]">
                <AuthRequiredCallout
                  providerId={provider}
                  identity={providerIdentity}
                  onRefresh={() => void refreshProviders()}
                />
              </div>
            ) : (
              <p className="mx-auto w-full max-w-[880px] text-sm text-muted-foreground">
                no turns yet — send a message.
              </p>
            )
          ) : (
            <ul
              className="mx-auto flex w-full max-w-[880px] flex-col"
              aria-live="polite"
              aria-relevant="additions"
            >
              {(() => {
                const toolishKinds = new Set([
                  'tool_call',
                  'file_edit',
                  'skill_invocation',
                  'permission_request',
                  'permission_decision',
                  'usage',
                ]);
                let lastDay: string | null = null;
                return items.map((item, idx) => {
                  const prev = idx > 0 ? (items[idx - 1] ?? null) : null;
                  const tightToTool =
                    prev !== null &&
                    toolishKinds.has(item.kind) &&
                    (toolishKinds.has(prev.kind) || prev.kind === 'assistant_text');
                  const node: React.ReactNode[] = [];
                  if (item.kind === 'user_text') {
                    const day = dayKey(item.at);
                    if (day !== lastDay) {
                      node.push(
                        <li key={`day-${day}-${idx}`} className="my-4 flex justify-center">
                          <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-2xs uppercase tracking-wide text-muted-foreground">
                            {formatDayLabel(item.at)}
                          </span>
                        </li>,
                      );
                      lastDay = day;
                    }
                  }
                  const isAssistantTurn = item.kind === 'assistant_text';
                  const prevIsAssistant = prev?.kind === 'assistant_text';
                  const showDivider = isAssistantTurn && prevIsAssistant;
                  node.push(
                    <li
                      key={item.key}
                      className={cn(
                        tightToTool ? 'mt-0.5' : idx === 0 ? '' : 'mt-8',
                        showDivider && 'border-t border-border/40 pt-8',
                      )}
                    >
                      <TranscriptCard
                        item={item}
                        taskId={session.id}
                        agentId={selectedAgentId}
                        onRefreshAuth={() => void refreshProviders()}
                      />
                    </li>,
                  );
                  return node;
                });
              })()}
              {isThinking ? (
                <li className="mt-8">
                  <ThinkingIndicator />
                </li>
              ) : null}
            </ul>
          )}
        </div>
        {!pinned ? (
          <button
            type="button"
            className="pointer-events-auto absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-background/95 px-3 py-1 text-xs shadow-md backdrop-blur-sm"
            onClick={() => {
              setPinned(true);
              const el = scrollerRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            jump to latest
          </button>
        ) : null}
      </div>
      {isEnded ? (
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          session ended — no further turns. branch preserved.
        </div>
      ) : (
        <ChatInput session={session} providerDisconnected={isProviderDisconnected} />
      )}
    </div>
  );
}
