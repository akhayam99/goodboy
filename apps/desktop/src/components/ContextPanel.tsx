import { useEffect, useState, useCallback, useMemo } from 'react';
import { PanelRightClose, PanelRightOpen, History, RotateCcw } from 'lucide-react';
import { ScrollArea, Textarea, Dialog, cn } from '@kay-am/ui';
import { SLOT_KEYS, SLOT_LABELS, type SlotKey } from '@kay-am/core';
import type {
  ContextSlot,
  ContextSlotHistoryEntry,
  Task,
  TaskId,
  TelemetryRecord,
} from '@kay-am/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionSlots,
  useSlotHistory,
  useSummarizerStatus,
} from '../store';

interface ContextPanelProps {
  session: Task;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}

type SummarizerStatusKind = 'idle' | 'running' | 'error';

export function ContextPanel({
  session,
  collapsed = false,
  onCollapse,
  onExpand,
}: ContextPanelProps) {
  const slots = useSessionSlots(session.id);
  const summarizer = useSummarizerStatus(session.id);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const sessionTelemetry = useAppStore(
    (s) => s.sessionTelemetry[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );

  const summarizerTotals = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;
    let count = 0;
    for (const rec of sessionTelemetry) {
      if (rec.kind !== 'summarizer') continue;
      inputTokens += rec.inputTokens;
      outputTokens += rec.outputTokens;
      estimatedCostUsd += rec.estimatedCostUsd;
      count += 1;
    }
    return { inputTokens, outputTokens, estimatedCostUsd, count };
  }, [sessionTelemetry]);

  const slotsByKey = new Map<string, ContextSlot>(slots.map((s) => [s.key, s]));

  if (collapsed) {
    return (
      <div className="flex h-full w-full justify-end pr-4 pt-4">
        <button
          type="button"
          onClick={onExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExpand?.();
            }
          }}
          title="expand context panel"
          aria-label="expand context panel"
          className={cn(
            'h-fit rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          )}
        >
          <PanelRightOpen size={13} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            context
          </span>
          <div className="flex items-center gap-1">
            <SummarizerBadge
              status={summarizer.status}
              lastUpdate={summarizer.lastUpdate}
              error={summarizer.error}
              totals={summarizerTotals}
            />
            {onCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                title="hide context panel"
                aria-label="hide context panel"
                className="rounded-sm p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <PanelRightClose size={13} aria-hidden />
              </button>
            ) : null}
          </div>
        </header>

        <ul className="flex flex-col gap-4">
          {SLOT_KEYS.map((key) => {
            const slot = slotsByKey.get(key);
            return (
              <SlotRow
                key={key}
                taskId={session.id}
                slotKey={key}
                slot={slot}
                onCommit={(value) => void upsertSessionSlot(session.id, key, value)}
              />
            );
          })}
        </ul>
      </div>
    </ScrollArea>
  );
}

interface SlotRowProps {
  taskId: TaskId;
  slotKey: SlotKey;
  slot: ContextSlot | undefined;
  onCommit: (value: string) => void;
}

function SlotRow({ taskId, slotKey, slot, onCommit }: SlotRowProps) {
  const value = slot?.value ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const history = useSlotHistory(taskId, slotKey);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const openHistory = useCallback(() => {
    void loadSlotHistory(taskId, slotKey);
    setHistoryOpen(true);
  }, [loadSlotHistory, taskId, slotKey]);

  const restore = useCallback(
    (entry: ContextSlotHistoryEntry) => {
      onCommit(entry.value);
      setHistoryOpen(false);
    },
    [onCommit],
  );

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {SLOT_LABELS[slotKey]}
        </label>
        <button
          type="button"
          onClick={openHistory}
          title="view history"
          aria-label={`view history for ${SLOT_LABELS[slotKey]}`}
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <History size={11} aria-hidden />
        </button>
      </div>

      {editing ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(value);
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          className="text-xs"
          autoGrow
          maxRows={12}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="whitespace-pre-wrap rounded-md border border-transparent bg-subtle px-2.5 py-2 text-left text-xs leading-relaxed hover:border-border-soft hover:bg-muted/40"
        >
          {value.length > 0 ? (
            value
          ) : (
            <span className="italic text-muted-foreground">empty — click to edit</span>
          )}
        </button>
      )}

      <SlotHistoryDialog
        label={SLOT_LABELS[slotKey]}
        open={historyOpen}
        entries={history}
        onRestore={restore}
        onClose={() => setHistoryOpen(false)}
      />
    </li>
  );
}

interface SlotHistoryDialogProps {
  label: string;
  open: boolean;
  entries: ReadonlyArray<ContextSlotHistoryEntry>;
  onRestore: (entry: ContextSlotHistoryEntry) => void;
  onClose: () => void;
}

function SlotHistoryDialog({ label, open, entries, onRestore, onClose }: SlotHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`history — ${label}`} size="lg">
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">no history yet</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide',
                    entry.author === 'user' ? 'bg-accent/10 text-accent' : 'bg-info/10 text-info',
                  )}
                >
                  {entry.author === 'user' ? 'you' : 'ai'}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {formatRelative(entry.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => onRestore(entry)}
                  title="restore this version"
                  aria-label="restore"
                  className="ml-auto flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <RotateCcw size={10} aria-hidden />
                  restore
                </button>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground line-clamp-4">
                {entry.value}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SummarizerBadge({
  status,
  lastUpdate,
  error,
  totals,
}: {
  status: SummarizerStatusKind;
  lastUpdate: string | null;
  error: string | null;
  totals: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
    readonly count: number;
  };
}) {
  if (status === 'idle') {
    if (totals.count === 0 || totals.estimatedCostUsd <= 0) return null;
    const tooltip = `summary total · ${totals.count} run${totals.count === 1 ? '' : 's'} · ${totals.inputTokens} in / ${totals.outputTokens} out · $${totals.estimatedCostUsd.toFixed(4)}${lastUpdate ? ` · last ${lastUpdate}` : ''}`;
    return (
      <span
        title={tooltip}
        className="rounded-full bg-subtle px-2 py-0.5 text-2xs text-muted-foreground"
      >
        Σ ${totals.estimatedCostUsd.toFixed(4)}
      </span>
    );
  }
  const styles: Record<Exclude<SummarizerStatusKind, 'idle'>, string> = {
    running: 'bg-info/10 text-info',
    error: 'bg-danger/10 text-danger',
  };
  const labels: Record<Exclude<SummarizerStatusKind, 'idle'>, string> = {
    running: 'summarizing…',
    error: 'error',
  };
  const tooltip =
    status === 'error' && error
      ? `last error: ${error}`
      : lastUpdate
        ? `last update: ${lastUpdate}`
        : 'summarizer running — keep typing, the app is not blocked';
  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide',
        styles[status],
      )}
    >
      {status === 'running' ? (
        <span className="flex gap-0.5" aria-hidden>
          <span className="h-1 w-1 animate-pulse rounded-full bg-info [animation-delay:0ms]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-info [animation-delay:150ms]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-info [animation-delay:300ms]" />
        </span>
      ) : null}
      {labels[status]}
    </span>
  );
}
