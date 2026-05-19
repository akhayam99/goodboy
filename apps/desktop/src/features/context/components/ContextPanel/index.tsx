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
import { ScrollArea, Textarea, Dialog, Markdown, cn } from '@kay-am/ui';
import { SLOT_KEYS, SLOT_LABELS, type SlotKey } from '@kay-am/core';
import type {
  ContextSlot,
  ContextSlotHistoryEntry,
  PlanStatus,
  PlanWithCount,
  Session,
  SessionId,
  TelemetryRecord,
} from '@kay-am/types';
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

  const visibleSlotKeys = useMemo(
    () =>
      SLOT_KEYS.filter((k) => k !== 'files_touched').sort((a, b) => {
        const order: Record<string, number> = {
          goal: 0,
          open_questions: 1,
          decisions: 2,
          last_output_summary: 3,
        };
        return (order[a] ?? 99) - (order[b] ?? 99);
      }),
    [],
  );

  const plans = useSessionPlans(session.id);
  const isFreshContext = useMemo(() => {
    if (loading.slots || loading.plans) return false;
    if (plans.length > 0) return false;
    const trimmedValue = (key: SlotKey) => slotsByKey.get(key)?.value?.trim() ?? '';
    return (
      trimmedValue('open_questions').length === 0 &&
      trimmedValue('decisions').length === 0 &&
      trimmedValue('last_output_summary').length === 0
    );
  }, [loading.slots, loading.plans, plans, slotsByKey]);

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

      <div className={cn('flex h-full min-h-0 flex-col', collapsed && 'hidden')}>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-4">
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

            {isFreshContext ? (
              <ContextFreshEmpty goal={session.goal} />
            ) : (
              <>
                <PlansSection sessionId={session.id} />
                {/* Per-slot independence: <ul> is always rendered. Each SlotRow
                    shows its own skeleton when its data slice is missing AND the
                    slots fetch is in flight. One slot finishing first paints
                    without waiting for siblings. */}
                <ul className="flex flex-col gap-6">
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
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border-soft px-3 py-3">
          <CostPill />
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
  readonly emphasis?: boolean;
  readonly tintedWhenNonEmpty?: string;
  readonly emptyLabel: string;
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
    emphasis: true,
    singleLine: true,
    emptyLabel: 'no goal set',
  },
  decisions: {
    icon: CheckCheck,
    iconClass: 'text-success',
    collapsible: true,
    defaultCollapsed: true,
    emptyLabel: 'no decisions yet',
  },
  open_questions: {
    icon: HelpCircle,
    iconClass: 'text-warning',
    tintedWhenNonEmpty: 'border-l-2 border-warning bg-warning/5',
    emptyLabel: 'no open questions',
  },
  last_output_summary: {
    icon: Activity,
    iconClass: 'text-info',
    collapsible: true,
    defaultCollapsed: true,
    emptyLabel: 'no output yet',
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

  const headerLabel = collapsible ? (
    <button
      type="button"
      onClick={() => setCollapsed((v) => !v)}
      className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      title={collapsed ? 'expand' : 'collapse'}
      aria-expanded={!collapsed}
    >
      <CollapseIcon size={11} aria-hidden className="shrink-0" />
      {Icon ? <Icon size={11} aria-hidden className={meta?.iconClass} /> : null}
      <span>{SLOT_LABELS[slotKey]}</span>
      {hasValue && collapsed ? (
        <span className="ml-1 normal-case tracking-normal text-2xs text-muted-foreground/70">
          {itemCount > 0 ? `· ${itemCount} item${itemCount === 1 ? '' : 's'}` : '· …'}
        </span>
      ) : null}
    </button>
  ) : (
    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {Icon ? <Icon size={11} aria-hidden className={meta?.iconClass} /> : null}
      {SLOT_LABELS[slotKey]}
    </label>
  );

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        {headerLabel}
        <button
          type="button"
          onClick={openHistory}
          title="view history"
          aria-label={`view history for ${SLOT_LABELS[slotKey]}`}
          className={cn(ICON_BTN, 'shrink-0')}
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
          className="text-left text-xs italic text-muted-foreground/60 hover:text-foreground"
        >
          {meta?.emptyLabel ?? 'empty, click to edit'}
        </button>
      ) : singleLine ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={value}
          className={cn(
            'truncate rounded-md border border-transparent bg-subtle px-2.5 py-1.5 text-left text-sm font-medium hover:border-border-soft hover:bg-muted/40',
            meta?.tintedWhenNonEmpty,
          )}
        >
          {value}
        </button>
      ) : collapsible && collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="expand"
          className={cn(
            'flex w-full items-center gap-1.5 truncate rounded-md border border-transparent bg-subtle px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:border-border-soft hover:bg-muted/40 hover:text-foreground',
          )}
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
          className={cn(
            'cursor-text rounded-md border border-transparent px-2.5 py-2 text-left leading-relaxed hover:border-border-soft hover:bg-muted/40 focus-visible:outline-none focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/15',
            'bg-subtle',
            meta?.tintedWhenNonEmpty,
          )}
        >
          <Markdown text={value} className="text-[13px] text-foreground" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'whitespace-pre-wrap break-words rounded-md border border-transparent px-2.5 py-2 text-left leading-relaxed hover:border-border-soft hover:bg-muted/40',
            meta?.emphasis ? 'bg-subtle text-sm font-medium' : 'bg-subtle text-xs',
            meta?.tintedWhenNonEmpty,
          )}
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

  useEffect(() => {
    void loadSessionPlans(sessionId);
  }, [sessionId, loadSessionPlans]);

  if (plans.length === 0 && loading.plans) return <PlansSkeleton />;
  if (plans.length === 0) return null;

  const latest = plans[plans.length - 1];
  if (!latest) return null;
  const latestIndex = plans.length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ClipboardList size={11} aria-hidden className="text-primary" />
          plans
        </span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title={`view all plans (${plans.length})`}
          aria-label={`view all plans (${plans.length})`}
          className={cn(ICON_BTN, 'inline-flex items-center gap-1 text-2xs')}
        >
          <span>{plans.length}</span>
          <List size={11} aria-hidden />
        </button>
      </div>
      <LatestPlanCard plan={latest} index={latestIndex} />
      <PlansModal
        sessionId={sessionId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialPlanId={latest.id}
      />
    </section>
  );
}

interface LatestPlanCardProps {
  readonly plan: PlanWithCount;
  readonly index: number;
}

function LatestPlanCard({ plan, index }: LatestPlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          title={expanded ? 'collapse plan' : 'expand plan'}
        >
          <Chevron size={11} aria-hidden className="shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
            plan {index}
          </span>
          <span className="truncate text-xs font-medium text-foreground">{plan.title}</span>
        </button>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
            PLAN_STATUS_STYLE[plan.status],
          )}
        >
          {plan.status}
        </span>
      </div>
      {expanded ? <Markdown text={plan.bodyMd} className="text-xs" /> : null}
    </div>
  );
}

const PROVIDER_DOT: Record<string, string> = {
  anthropic: 'bg-[var(--color-provider-anthropic)]',
  cursor: 'bg-[var(--color-provider-cursor)]',
  codex: 'bg-[var(--color-provider-codex)]',
};

const formatCostUsd = (usd: number): string => (usd === 0 ? '$0' : `$${usd.toFixed(2)}`);

function CostPill() {
  const sessionSummary = useAppStore((s) => s.sessionSummary);
  const workspaceSummary = useAppStore((s) => s.workspaceSummary);
  const providerSpend = useAppStore((s) => s.providerSpendBreakdown);

  const sessionCost = sessionSummary?.estimatedCostUsd ?? 0;
  const workspaceCost = workspaceSummary?.estimatedCostUsd ?? 0;

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      title={`session: ${formatCostUsd(sessionCost)}\nworkspace: ${formatCostUsd(workspaceCost)}`}
    >
      <span className="font-medium">{formatCostUsd(sessionCost)}</span>
      <span>session</span>
      <span aria-hidden className="opacity-40">
        ·
      </span>
      <span className="font-medium">{formatCostUsd(workspaceCost)}</span>
      {providerSpend.length > 0 ? (
        <span aria-hidden className="ml-0.5 flex items-center -space-x-0.5">
          {providerSpend
            .filter((p) => p.spentUsd > 0)
            .slice(0, 3)
            .map((p) => (
              <span
                key={p.provider}
                className={`inline-block h-2 w-2 rounded-full ring-1 ring-background ${PROVIDER_DOT[p.provider] ?? 'bg-muted-foreground/40'}`}
              />
            ))}
        </span>
      ) : null}
    </div>
  );
}

interface ContextFreshEmptyProps {
  readonly goal: string;
}

function ContextFreshEmpty({ goal }: ContextFreshEmptyProps) {
  const trimmedGoal = goal.trim();
  return (
    <div className="flex flex-col items-center gap-4 px-2 py-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/20">
        <BookOpen size={24} aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          Context is empty
        </span>
        <h3 className="text-sm font-semibold text-foreground">Your shared agent brief</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          This panel keeps every agent on the same page. Open questions, decisions and the latest
          output summary land here as you work, so spawning a new agent never resets the
          conversation.
        </p>
      </div>
      {trimmedGoal.length > 0 ? (
        <div className="flex w-full flex-col gap-1.5 rounded-md bg-subtle/60 px-3 py-2.5 text-left ring-1 ring-border-soft">
          <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/80">
            <Target size={10} aria-hidden className="text-accent" />
            Goal
          </span>
          <span className="text-xs leading-snug text-foreground">{trimmedGoal}</span>
        </div>
      ) : null}
      <div className="flex w-full flex-col gap-2 rounded-md bg-subtle/40 px-3 py-2.5 text-left ring-1 ring-border-soft">
        <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          <Activity size={10} aria-hidden className="text-info" />
          How it works
        </span>
        <ol className="flex flex-col gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <li className="flex gap-1.5">
            <span aria-hidden className="shrink-0 font-mono text-muted-foreground/50">
              1.
            </span>
            <span>
              At the end of every turn, a summarizer fires automatically in the background.
            </span>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden className="shrink-0 font-mono text-muted-foreground/50">
              2.
            </span>
            <span>
              It uses the <span className="text-foreground">cheapest model</span> of the same
              provider as the turn (Haiku for Claude, mini for Codex, etc.), so the overhead stays
              negligible.
            </span>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden className="shrink-0 font-mono text-muted-foreground/50">
              3.
            </span>
            <span>
              It reads the assistant&rsquo;s full reply and updates the slots above: new decisions,
              still-open questions, a fresh output summary.
            </span>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden className="shrink-0 font-mono text-muted-foreground/50">
              4.
            </span>
            <span>
              You can edit any slot inline at any time. Manual edits win over the next summarizer
              pass.
            </span>
          </li>
          <li className="flex gap-1.5">
            <span aria-hidden className="shrink-0 font-mono text-muted-foreground/50">
              5.
            </span>
            <span>
              Every slot keeps a full history. Click the{' '}
              <History size={10} aria-hidden className="inline -translate-y-px" /> icon on any slot
              to browse previous versions and roll back if needed.
            </span>
          </li>
        </ol>
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground/60">
        Slots fill in automatically once the first turn completes.
      </p>
    </div>
  );
}
