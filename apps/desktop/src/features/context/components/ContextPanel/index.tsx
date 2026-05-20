import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  PanelRightClose,
  PanelRightOpen,
  History,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Target,
  CheckCheck,
  HelpCircle,
  Activity,
  ClipboardList,
  List,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { Divider, ScrollArea, Textarea, Dialog, Markdown, cn } from '@goodboy/ui';
import { SLOT_KEYS, SLOT_LABELS, type SlotKey } from '@goodboy/core';
import type {
  ContextSlot,
  ContextSlotHistoryEntry,
  PlanStatus,
  PlanWithCount,
  Session,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';
import { PlansModal } from '../../../../features/plans/components/PlansModal';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionLoading,
  useSessionPlans,
  useSessionSlots,
  useSlotHistory,
  useSummarizerStatus,
} from '../../../../store';

interface ContextPanelProps {
  session: Session;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  // Keep-alive aware: false when this panel is mounted but hidden behind
  // another session. Effects that touch DB or network gate on this so
  // background panels don't churn.
  isActive?: boolean;
}

type SummarizerStatusKind = 'idle' | 'running' | 'error';

const ICON_BTN =
  'rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground' as const;

export function ContextPanel({
  session,
  collapsed = false,
  onCollapse,
  onExpand,
  isActive = true,
}: ContextPanelProps) {
  const slots = useSessionSlots(session.id);
  const summarizer = useSummarizerStatus(session.id);
  const loading = useSessionLoading(session.id);
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

  const workingDir = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);

  const slotsByKey = new Map<string, ContextSlot>(
    slots.map((s) => [s.key, s.key === 'files_touched' ? normalizeFilesSlot(s, workingDir) : s]),
  );

  // open_questions is pinned in a sticky footer; goal/decisions/last_output_summary
  // remain inline in the scroll area.
  const visibleSlotKeys = useMemo(
    () =>
      SLOT_KEYS.filter((k) => k !== 'files_touched' && k !== 'open_questions').sort((a, b) => {
        const order: Record<string, number> = {
          goal: 0,
          decisions: 1,
          last_output_summary: 2,
        };
        return (order[a] ?? 99) - (order[b] ?? 99);
      }),
    [],
  );

  return (
    <>
      <div className={cn('flex h-full w-full justify-end pr-4 pt-4', !collapsed && 'hidden')}>
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
            'h-fit',
            ICON_BTN,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          )}
        >
          <PanelRightOpen size={13} aria-hidden />
        </button>
      </div>

      <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', collapsed && 'hidden')}>
        <div className="shrink-0 flex flex-col gap-4 px-4 pt-4 pb-2">
          <header className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <BookOpen size={11} aria-hidden className="text-accent" />
              Context
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
                  className={ICON_BTN}
                >
                  <PanelRightClose size={13} aria-hidden />
                </button>
              ) : null}
            </div>
          </header>
        </div>

        {/* top — always-on slots that summarize the session state */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 pb-3">
          <ul className="flex min-h-0 flex-1 flex-col gap-2.5">
            {visibleSlotKeys.map((key) => {
              const slot = slotsByKey.get(key);
              return (
                <SlotRow
                  key={key}
                  sessionId={session.id}
                  slotKey={key}
                  slot={slot}
                  loading={loading.slots}
                  isSummarizing={summarizer.status === 'running'}
                  onCommit={(value) => void upsertSessionSlot(session.id, key, value)}
                />
              );
            })}
          </ul>
        </div>

        <Divider />

        {/* bottom — pinned sections that may be empty: questions first, plans second */}
        <div className="flex shrink-0 flex-col gap-2.5 bg-subtle/30 px-4 py-3">
          <ul className="flex flex-col">
            <SlotRow
              sessionId={session.id}
              slotKey="open_questions"
              slot={slotsByKey.get('open_questions')}
              loading={loading.slots}
              isSummarizing={summarizer.status === 'running'}
              onCommit={(value) => void upsertSessionSlot(session.id, 'open_questions', value)}
            />
          </ul>
          <PlansSection sessionId={session.id} />
        </div>
      </div>
    </>
  );
}

function SlotSkeleton({ emphasis }: { emphasis?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md px-2.5 py-2 bg-subtle',
        emphasis ? 'gap-2.5' : 'gap-1.5',
      )}
      aria-hidden
    >
      <div
        className={cn(
          'animate-pulse rounded bg-muted/70',
          emphasis ? 'h-3.5 w-3/4' : 'h-2.5 w-4/5',
        )}
      />
      <div
        className={cn(
          'animate-pulse rounded bg-muted/70',
          emphasis ? 'h-3.5 w-full' : 'h-2.5 w-full',
        )}
      />
      <div
        className={cn(
          'animate-pulse rounded bg-muted/70',
          emphasis ? 'h-3.5 w-1/2' : 'h-2.5 w-2/3',
        )}
      />
    </div>
  );
}

function SlotRowSkeleton({ slotKey }: { slotKey: SlotKey }) {
  return (
    <li role="status" aria-label={`loading ${slotKey}`} className="flex flex-col gap-2">
      <div className="h-2.5 w-20 animate-pulse rounded bg-muted/70" />
      <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-muted/70" />
    </li>
  );
}

function PlansSkeleton() {
  return (
    <div role="status" aria-label="loading plans" className="flex flex-col gap-2 pb-2">
      <div className="h-2.5 w-16 animate-pulse rounded bg-muted/70" />
      <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
    </div>
  );
}

interface SlotMeta {
  readonly icon: LucideIcon;
  readonly iconClass: string;
  readonly iconChipBg: string;
  readonly description: string;
  readonly emphasis?: boolean;
  /** Tailwind ring-* class to swap the default border-soft ring when hasValue. */
  readonly accentRingWhenNonEmpty?: string;
  readonly emptyLabel: string;
  readonly emptyCta: string;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly singleLine?: boolean;
}

const MARKDOWN_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>([
  'open_questions',
  'decisions',
  'last_output_summary',
]);

const SLOT_META: Record<Exclude<SlotKey, 'files_touched'>, SlotMeta> = {
  goal: {
    icon: Target,
    iconClass: 'text-primary',
    iconChipBg: 'bg-primary/10 ring-primary/20',
    description: 'What this session is set out to achieve',
    emphasis: true,
    singleLine: true,
    emptyLabel: 'No goal yet',
    emptyCta: 'Add the session goal',
  },
  open_questions: {
    icon: HelpCircle,
    iconClass: 'text-warning',
    iconChipBg: 'bg-warning/10 ring-warning/20',
    description: 'Things the puppy still needs clarified',
    accentRingWhenNonEmpty: 'ring-warning/60',
    emptyLabel: 'No open questions',
    emptyCta: 'Add a question to ask the user',
  },
  decisions: {
    icon: CheckCheck,
    iconClass: 'text-success',
    iconChipBg: 'bg-success/10 ring-success/20',
    description: 'Choices already locked in for this session',
    collapsible: true,
    defaultCollapsed: true,
    emptyLabel: 'No decisions yet',
    emptyCta: 'Log a decision',
  },
  last_output_summary: {
    icon: Activity,
    iconClass: 'text-info',
    iconChipBg: 'bg-info/10 ring-info/20',
    description: "Summary of the assistant's most recent reply",
    collapsible: true,
    defaultCollapsed: true,
    emptyLabel: 'No output yet',
    emptyCta: 'Write a manual summary',
  },
};

function countMarkdownItems(value: string): number {
  return value.split('\n').filter((l) => /^\s*([-*+]|\d+\.)\s+/.test(l)).length;
}

function firstMeaningfulLine(value: string): string {
  for (const raw of value.split('\n')) {
    const t = raw
      .trim()
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^#+\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '');
    if (t) return t;
  }
  return '';
}

function normalizeFilesSlot(slot: ContextSlot, workingDir: string | null): ContextSlot {
  if (!workingDir || slot.value.length === 0) return slot;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  const normalized = slot.value
    .split('\n')
    .map((p) => (p.startsWith(root) ? p.slice(root.length) : p))
    .join('\n');
  return normalized === slot.value ? slot : { ...slot, value: normalized };
}

interface SlotRowProps {
  sessionId: SessionId;
  slotKey: SlotKey;
  slot: ContextSlot | undefined;
  loading?: boolean;
  isSummarizing?: boolean;
  onCommit: (value: string) => void;
}

function SlotRow({
  sessionId,
  slotKey,
  slot,
  loading = false,
  isSummarizing = false,
  onCommit,
}: SlotRowProps) {
  const value = slot?.value ?? '';
  const meta = slotKey === 'files_touched' ? null : SLOT_META[slotKey];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(meta?.defaultCollapsed ?? false);

  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const history = useSlotHistory(sessionId, slotKey);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const openHistory = useCallback(() => {
    void loadSlotHistory(sessionId, slotKey);
    setHistoryOpen(true);
  }, [loadSlotHistory, sessionId, slotKey]);

  const restore = useCallback(
    (entry: ContextSlotHistoryEntry) => {
      onCommit(entry.value);
      setHistoryOpen(false);
    },
    [onCommit],
  );

  // Per-slot skeleton: while the slots fetch is still in flight and this
  // particular slot hasn't materialized yet, show a placeholder. Sibling
  // slots that already arrived render their content independently. Must
  // come after all hook calls — React requires a stable hook order across
  // renders, and slot can flip between undefined/defined on workspace switch.
  if (slot === undefined && loading) return <SlotRowSkeleton slotKey={slotKey} />;

  const Icon = meta?.icon;
  const hasValue = value.length > 0;
  const renderAsMarkdown = MARKDOWN_SLOTS.has(slotKey);
  const collapsible = meta?.collapsible ?? false;
  const singleLine = meta?.singleLine ?? false;
  const itemCount = collapsible && hasValue ? countMarkdownItems(value) : 0;
  const preview = collapsible && hasValue ? firstMeaningfulLine(value) : '';
  const CollapseIcon = collapsed ? ChevronRight : ChevronDown;

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const itemCountLabel =
    hasValue && itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : null;

  const headerToggle = collapsible ? (
    <button
      type="button"
      onClick={() => setCollapsed((v) => !v)}
      title={collapsed ? 'Expand' : 'Collapse'}
      aria-expanded={!collapsed}
      className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
    >
      <CollapseIcon size={11} aria-hidden />
    </button>
  ) : null;

  const accentRing =
    hasValue && meta?.accentRingWhenNonEmpty ? meta.accentRingWhenNonEmpty : 'ring-border-soft';

  return (
    <li
      className={cn(
        'group relative flex min-h-0 flex-col gap-2 rounded-lg bg-elevated p-3 ring-1 transition-colors',
        accentRing,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <span
            aria-hidden
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-md ring-1',
              meta?.iconChipBg,
            )}
          >
            <Icon size={11} className={meta?.iconClass} aria-hidden />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-foreground">
            <span>{SLOT_LABELS[slotKey]}</span>
            {itemCountLabel ? (
              <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
                · {itemCountLabel}
              </span>
            ) : null}
          </span>
          {meta?.description ? (
            <span className="text-[10px] leading-tight text-muted-foreground/60">
              {meta.description}
            </span>
          ) : null}
        </div>
        {headerToggle}
        <button
          type="button"
          onClick={openHistory}
          title="View history"
          aria-label={`view history for ${SLOT_LABELS[slotKey]}`}
          className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-foreground/10 hover:text-foreground group-hover:opacity-100"
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
          className="font-mono text-xs"
          autoGrow
          maxRows={16}
        />
      ) : isSummarizing ? (
        <SlotSkeleton emphasis={meta?.emphasis} />
      ) : !hasValue ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex flex-col items-start gap-0.5 rounded text-left text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <span>{meta?.emptyLabel ?? 'Empty'}</span>
          <span className="text-[10px] text-muted-foreground/40 underline-offset-2 group-hover:underline">
            {meta?.emptyCta ?? 'Click to edit'}
          </span>
        </button>
      ) : singleLine ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={value}
          className="cursor-text rounded text-left text-sm font-medium leading-snug text-foreground transition-colors hover:bg-foreground/5"
        >
          {value}
        </button>
      ) : collapsible && collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Expand"
          className="flex w-full cursor-pointer items-center gap-1.5 truncate rounded text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="truncate">{preview}</span>
        </button>
      ) : renderAsMarkdown ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className="min-h-0 flex-1 cursor-text overflow-y-auto overflow-x-hidden rounded pr-3 text-left leading-relaxed transition-colors [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/15 [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all"
          style={{ scrollbarGutter: 'stable' }}
        >
          <Markdown text={value} className="text-[13px] text-foreground" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'min-h-0 flex-1 cursor-text overflow-y-auto whitespace-pre-wrap break-words rounded pr-3 text-left leading-relaxed transition-colors hover:bg-foreground/5',
            meta?.emphasis ? 'text-sm font-medium' : 'text-xs',
          )}
          style={{ scrollbarGutter: 'stable' }}
        >
          {value}
        </button>
      )}

      <SlotHistoryDialog
        label={SLOT_LABELS[slotKey]}
        renderAsMarkdown={renderAsMarkdown}
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
  renderAsMarkdown: boolean;
  open: boolean;
  entries: ReadonlyArray<ContextSlotHistoryEntry>;
  onRestore: (entry: ContextSlotHistoryEntry) => void;
  onClose: () => void;
}

function SlotHistoryDialog({
  label,
  renderAsMarkdown,
  open,
  entries,
  onRestore,
  onClose,
}: SlotHistoryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`history: ${label}`} size="xl">
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">no history yet</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle p-3"
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
              {renderAsMarkdown ? (
                <div className="max-h-40 overflow-hidden text-xs leading-relaxed text-foreground">
                  <Markdown text={entry.value} className="text-xs" />
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground line-clamp-4">
                  {entry.value}
                </p>
              )}
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
    const tooltip =
      totals.count === 0
        ? 'summarizer has not run yet'
        : `summary total · ${totals.count} run${totals.count === 1 ? '' : 's'} · ${totals.inputTokens} in / ${totals.outputTokens} out · $${totals.estimatedCostUsd.toFixed(4)}${lastUpdate ? ` · last ${lastUpdate}` : ''}`;
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
  const tooltip = (() => {
    if (status === 'error' && error) return `last error: ${error}`;
    if (lastUpdate) return `last update: ${lastUpdate}`;
    return 'summarizer running; input is not blocked';
  })();
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

const PLAN_STATUS_STYLE: Record<PlanStatus, string> = {
  active: 'bg-warning/10 text-warning',
  consumed: 'bg-info/10 text-info',
  superseded: 'bg-muted text-muted-foreground',
};

function PlansSection({ sessionId }: { sessionId: SessionId }) {
  const plans = useSessionPlans(sessionId);
  const loading = useSessionLoading(sessionId);
  const loadSessionPlans = useAppStore((s) => s.loadSessionPlans);
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void loadSessionPlans(sessionId);
  }, [sessionId, loadSessionPlans]);

  if (plans.length === 0 && loading.plans) return <PlansSkeleton />;
  if (plans.length === 0) return <PlansEmpty />;

  const latest = plans[plans.length - 1];
  if (!latest) return null;
  const latestIndex = plans.length;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <section className="group relative flex min-h-0 flex-col gap-2 rounded-lg bg-elevated p-3 ring-1 ring-border-soft transition-colors">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20"
        >
          <ClipboardList size={11} className="text-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-foreground">
            <span>Plans</span>
            <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
              · {plans.length} total
            </span>
          </span>
          <span className="text-[10px] leading-tight text-muted-foreground/60">
            Step-by-step plans queued for this session
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Chevron size={11} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title={`View all plans (${plans.length})`}
          aria-label={`view all plans (${plans.length})`}
          className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-foreground/10 hover:text-foreground group-hover:opacity-100"
        >
          <List size={11} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 rounded text-left transition-colors hover:bg-foreground/5"
        title={expanded ? 'Collapse plan' : 'Expand plan'}
      >
        <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground/70">
          plan {latestIndex}
        </span>
        <span className="truncate text-xs font-medium text-foreground">{latest.title}</span>
        <span
          className={cn(
            'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
            PLAN_STATUS_STYLE[latest.status],
          )}
        >
          {latest.status}
        </span>
      </button>

      {expanded ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-3 text-left leading-relaxed [overflow-wrap:anywhere] [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all"
          style={{ scrollbarGutter: 'stable' }}
        >
          <Markdown text={latest.bodyMd} className="text-[13px] text-foreground" />
        </div>
      ) : null}

      <PlansModal
        sessionId={sessionId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPlanId={latest.id}
      />
    </section>
  );
}

function PlansEmpty() {
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-elevated p-3 ring-1 ring-border-soft">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20"
        >
          <ClipboardList size={11} className="text-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-foreground">
            Plans
          </span>
          <span className="text-[10px] leading-tight text-muted-foreground/60">
            Step-by-step plans queued for this session
          </span>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground/70">
        No plans yet. Spawn a <span className="font-medium text-foreground">Plan</span> puppy and
        ask it to map the work — its output lands here, ready to feed an Implement puppy.
      </p>
    </section>
  );
}
