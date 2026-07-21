import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, FileText, History, RotateCcw, Target } from 'lucide-react';
import { Button, Dialog, EmptyState, Markdown, Textarea, cn, type Tone } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';
import type { ContextSlotHistoryEntry, Session, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionLoading,
  useSessionSlots,
  useSlotHistory,
  useSummarizerStatus,
} from '../../../../../store';
import { GoalAttachmentsStrip } from '../../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { PaneShell } from './PaneShell';

type SlotKey = 'goal' | 'decisions' | 'last_output_summary';

const SLOT_TITLE: Record<SlotKey, string> = {
  goal: 'Goal',
  decisions: 'Decisions',
  last_output_summary: 'Session TLDR',
};

const SLOT_DESCRIPTION: Record<SlotKey, string> = {
  goal: 'What this session is meant to achieve.',
  decisions: 'Choices already locked in for this session.',
  last_output_summary:
    'What this session has accomplished, its current state, and what is in flight.',
};

const SLOT_EMPTY_CTA: Record<SlotKey, string> = {
  goal: 'Add the session goal',
  decisions: 'Log a decision',
  last_output_summary: 'Write a manual session TLDR',
};

const SLOT_ICON: Record<SlotKey, LucideIcon> = {
  goal: Target,
  decisions: CheckSquare,
  last_output_summary: FileText,
};

const SLOT_TONE: Record<SlotKey, Tone> = {
  goal: 'primary',
  decisions: 'success',
  last_output_summary: 'info',
};

const SLOT_EMPTY_DESCRIPTION: Record<SlotKey, string> = {
  goal: 'What this session is meant to achieve.',
  decisions: 'Choices already locked in for this session.',
  last_output_summary:
    'What this session has accomplished, its current state, and what is in flight.',
};

const MARKDOWN_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>(['decisions', 'last_output_summary']);

type SlotPaneProps = {
  readonly session: Session;
  readonly slotKey: SlotKey;
};

export const SlotPane = ({ session, slotKey }: SlotPaneProps) => {
  const sessionId = session.id as SessionId;
  const slots = useSessionSlots(sessionId);
  const loading = useSessionLoading(sessionId);
  const summarizer = useSummarizerStatus(sessionId);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const history = useSlotHistory(sessionId, slotKey);

  const slot = useMemo(() => slots.find((s) => s.key === slotKey), [slots, slotKey]);
  const value = slot?.value ?? '';
  const hasValue = value.length > 0;
  const renderAsMarkdown = MARKDOWN_SLOTS.has(slotKey);
  const isSummarizing = summarizer.status === 'running';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) void upsertSessionSlot(sessionId, slotKey, draft);
  };

  const startEditing = () => {
    if (isSummarizing) return;
    setEditing(true);
  };

  const openHistory = () => {
    void loadSlotHistory(sessionId, slotKey);
    setHistoryOpen(true);
  };

  return (
    <PaneShell
      title={SLOT_TITLE[slotKey]}
      description={SLOT_DESCRIPTION[slotKey]}
      actions={
        <>
          {history.length > 0 ? (
            <button
              type="button"
              onClick={openHistory}
              title="View history"
              aria-label={`view history for ${SLOT_TITLE[slotKey]}`}
              className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <History size={15} aria-hidden />
            </button>
          ) : null}
        </>
      }
    >
      <>
        {slot === undefined && loading.slots ? (
          <div className="flex flex-col gap-2">
            <div className="h-4 w-full rounded bg-muted/50" />
            <div className="h-4 w-3/4 rounded bg-muted/50" />
          </div>
        ) : editing ? (
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
            className="font-mono text-sm"
            autoGrow
            maxRows={24}
          />
        ) : !hasValue ? (
          <EmptyState
            bordered
            tone={SLOT_TONE[slotKey]}
            icon={SLOT_ICON[slotKey]}
            title={SLOT_EMPTY_CTA[slotKey]}
            description={SLOT_EMPTY_DESCRIPTION[slotKey]}
            action={
              <Button size="sm" variant="ghost" onClick={startEditing} disabled={isSummarizing}>
                Add
              </Button>
            }
          />
        ) : renderAsMarkdown ? (
          <div
            role={isSummarizing ? undefined : 'button'}
            tabIndex={isSummarizing ? -1 : 0}
            onClick={startEditing}
            onKeyDown={(e) => {
              if (isSummarizing) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setEditing(true);
              }
            }}
            className={cn(
              'rounded-lg leading-relaxed transition-colors [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/15 [&_code]:break-all [&_pre]:whitespace-pre-wrap [&_pre]:break-all',
              isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/[0.02]',
            )}
          >
            <Markdown text={value} className="text-sm text-foreground" />
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            disabled={isSummarizing}
            className={cn(
              'whitespace-pre-wrap break-words rounded-lg text-left text-base font-medium leading-relaxed text-foreground transition-colors',
              isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/[0.02]',
            )}
          >
            {value}
          </button>
        )}

        {slotKey === 'goal' ? (
          <GoalAttachmentsStrip owner={{ type: 'session', id: sessionId }} />
        ) : null}

        <SlotHistoryDialog
          label={SLOT_TITLE[slotKey]}
          renderAsMarkdown={renderAsMarkdown}
          open={historyOpen}
          entries={history}
          onRestore={(entry) => {
            void upsertSessionSlot(sessionId, slotKey, entry.value);
            setHistoryOpen(false);
          }}
          onClose={() => setHistoryOpen(false)}
        />
      </>
    </PaneShell>
  );
};

type SlotHistoryDialogProps = {
  readonly label: string;
  readonly renderAsMarkdown: boolean;
  readonly open: boolean;
  readonly entries: ReadonlyArray<ContextSlotHistoryEntry>;
  readonly onRestore: (entry: ContextSlotHistoryEntry) => void;
  readonly onClose: () => void;
};

const SlotHistoryDialog = ({
  label,
  renderAsMarkdown,
  open,
  entries,
  onRestore,
  onClose,
}: SlotHistoryDialogProps) => (
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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
