import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  History,
  RotateCcw,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { Dialog, Markdown, Textarea, cn } from '@goodboy/ui';
import { SLOT_LABELS, type SlotKey } from '@goodboy/core';
import type { ContextSlot, ContextSlotHistoryEntry, SessionId } from '@goodboy/types';
import { useAppStore, useSlotHistory } from '../../../../store';

function SlotRowSkeleton({ slotKey }: { slotKey: SlotKey }) {
  return (
    <li role="status" aria-label={`loading ${slotKey}`} className="flex flex-col gap-2">
      <div className="h-2.5 w-20 rounded bg-muted/50" />
      <div className="h-3 w-full rounded bg-muted/50" />
      <div className="h-3 w-3/4 rounded bg-muted/50" />
    </li>
  );
}

interface SlotMeta {
  readonly icon: LucideIcon;
  readonly iconClass: string;
  readonly iconChipBg: string;
  readonly description: string;
  readonly emphasis?: boolean;
  readonly accentRingWhenNonEmpty?: string;
  readonly emptyLabel: string;
  readonly emptyCta: string;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly singleLine?: boolean;
  readonly readOnly?: boolean;
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
    description: 'What this session is meant to achieve',
    emphasis: true,
    singleLine: true,
    emptyLabel: 'No goal yet',
    emptyCta: 'Add the session goal',
  },
  open_questions: {
    icon: HelpCircle,
    iconClass: 'text-warning',
    iconChipBg: 'bg-warning/10 ring-warning/20',
    description: 'Things the agent still needs clarified',
    accentRingWhenNonEmpty: 'ring-warning/60',
    emptyLabel: 'No open questions',
    emptyCta: '',
    readOnly: true,
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
    description: "Summary of the agent's most recent reply",
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

interface SlotRowProps {
  sessionId: SessionId;
  slotKey: SlotKey;
  slot: ContextSlot | undefined;
  loading?: boolean;
  isSummarizing?: boolean;
  onCommit: (value: string) => void;
}

export function SlotRow({
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

  const inactive = !hasValue;
  const ringClass = inactive
    ? 'ring-border-soft/30'
    : (meta?.accentRingWhenNonEmpty ?? 'ring-border-soft');

  return (
    <li
      className={cn(
        'group relative flex flex-none flex-col gap-2 rounded-lg p-3 ring-1 transition-colors',
        inactive ? 'bg-transparent' : 'bg-muted/40',
        ringClass,
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
        {history.length > 0 ? (
          <button
            type="button"
            onClick={openHistory}
            title="View history"
            aria-label={`view history for ${SLOT_LABELS[slotKey]}`}
            className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <History size={11} aria-hidden />
          </button>
        ) : null}
        {headerToggle}
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
      ) : !hasValue ? (
        meta?.readOnly ? (
          <span className="text-xs text-muted-foreground/50">{meta.emptyLabel}</span>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isSummarizing) return;
              setEditing(true);
            }}
            disabled={isSummarizing}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded text-left text-xs text-muted-foreground/60 transition-colors',
              isSummarizing ? 'cursor-default' : 'hover:text-foreground',
            )}
          >
            <span>{meta?.emptyLabel ?? 'Empty'}</span>
            <span className="text-[10px] text-muted-foreground/40 underline-offset-2 group-hover:underline">
              {meta?.emptyCta ?? 'Click to edit'}
            </span>
          </button>
        )
      ) : singleLine ? (
        <button
          type="button"
          onClick={() => {
            if (isSummarizing) return;
            setEditing(true);
          }}
          disabled={isSummarizing}
          title={value}
          className={cn(
            'rounded text-left text-sm font-medium leading-snug text-foreground transition-colors',
            isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/5',
          )}
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
          role={isSummarizing ? undefined : 'button'}
          tabIndex={isSummarizing ? -1 : 0}
          onClick={() => {
            if (isSummarizing) return;
            setEditing(true);
          }}
          onKeyDown={(e) => {
            if (isSummarizing) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className={cn(
            'rounded text-left leading-relaxed transition-colors [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/15 [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all',
            isSummarizing ? 'cursor-default' : 'cursor-text',
          )}
        >
          <Markdown text={value} className="text-[13px] text-foreground" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (isSummarizing) return;
            setEditing(true);
          }}
          disabled={isSummarizing}
          className={cn(
            'whitespace-pre-wrap break-words rounded text-left leading-relaxed transition-colors',
            isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/5',
            meta?.emphasis ? 'text-sm font-medium' : 'text-xs',
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
                  {entry.author === 'user' ? 'you' : 'agent'}
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
