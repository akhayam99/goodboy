import { useEffect, useMemo, useState } from 'react';
import { History, type LucideIcon } from 'lucide-react';
import { Button, Markdown, Textarea, cn, type Tone } from '@goodboy/ui';
import { LensEmptyState } from '../../../../../shared/components/LensEmptyState';
import type { Session, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionSlots,
  useSlotHistory,
  useSummarizerStatus,
} from '../../../../../store';
import { GoalAttachmentsStrip } from '../../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { InspectorSplit } from './InspectorSplit';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { SlotHistoryPanel } from './SlotHistoryPanel';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { CopyButton } from '../../../../../shared/components/CopyButton';

type SlotKey = 'goal' | 'decisions' | 'last_output_summary';

const SLOT_TITLE: Record<SlotKey, string> = {
  goal: 'Goal',
  decisions: 'Decisions',
  last_output_summary: 'Session summary',
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
  last_output_summary: 'Write a session summary',
};

const SLOT_TONE: Record<SlotKey, Tone> = {
  goal: 'primary',
  decisions: 'success',
  last_output_summary: 'info',
};

const SLOT_ICON = {
  goal: CONCEPT_ICONS.goal,
  decisions: CONCEPT_ICONS.decisions,
  last_output_summary: CONCEPT_ICONS.sessionSummary,
} satisfies Record<SlotKey, LucideIcon>;

const SLOT_EMPTY_DESCRIPTION =
  'The summarizer fills this at the end of a turn. Create an agent or a workflow to begin.';

const MARKDOWN_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>(['decisions', 'last_output_summary']);

type Props = {
  readonly session: Session;
  readonly slotKey: SlotKey;
};

export const SlotPane = ({ session, slotKey }: Props) => {
  const sessionId = session.id as SessionId;
  const slots = useSessionSlots(sessionId);
  const loading = useSessionLoading(sessionId);
  const summarizer = useSummarizerStatus(sessionId);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  const history = useSlotHistory(sessionId, slotKey);
  const openQuestions = useSessionOpenQuestions(sessionId);

  const slot = useMemo(() => slots.find((s) => s.key === slotKey), [slots, slotKey]);
  const value = slot?.value ?? '';
  const hasValue = value.length > 0;
  const renderAsMarkdown = MARKDOWN_SLOTS.has(slotKey);
  const isSummarizing = summarizer.status === 'running';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  useEffect(() => {
    if (slotKey === 'last_output_summary') {
      void loadSessionOpenQuestions(sessionId);
    }
  }, [slotKey, sessionId, loadSessionOpenQuestions]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      void upsertSessionSlot(sessionId, slotKey, draft);
    }
  };

  const startEditing = () => {
    if (isSummarizing) {
      return;
    }
    setEditing(true);
  };

  const toggleHistory = () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    void loadSlotHistory(sessionId, slotKey);
    setHistoryOpen(true);
  };

  const buildShareableDocument = (): string => {
    const goalSlot = slots.find((s) => s.key === 'goal');
    const decisionsSlot = slots.find((s) => s.key === 'decisions');
    const summarySlot = slots.find((s) => s.key === 'last_output_summary');

    const parts: string[] = [];

    if (goalSlot?.value) {
      parts.push(`## Goal\n\n${goalSlot.value}`);
    }

    if (summarySlot?.value) {
      parts.push(`## Session summary\n\n${summarySlot.value}`);
    }

    if (decisionsSlot?.value) {
      parts.push(`## Decisions\n\n${decisionsSlot.value}`);
    }

    const openOnly = openQuestions.filter((q) => q.status === 'open');
    if (openOnly.length > 0) {
      const items = openOnly.map((q) => `- ${q.text}`).join('\n');
      parts.push(`## Open questions\n\n${items}`);
    }

    return parts.join('\n\n');
  };

  return (
    <InspectorSplit
      open={historyOpen}
      panel={
        <SlotHistoryPanel
          label={SLOT_TITLE[slotKey]}
          renderAsMarkdown={renderAsMarkdown}
          entries={history}
          onRestore={(entry) => {
            void upsertSessionSlot(sessionId, slotKey, entry.value);
            setHistoryOpen(false);
          }}
          onClose={() => setHistoryOpen(false)}
        />
      }
    >
      <PaneShell
        title={SLOT_TITLE[slotKey]}
        description={SLOT_DESCRIPTION[slotKey]}
        measure="reading"
        actions={
          <>
            {hasValue ? (
              <CopyButton
                value={slotKey === 'last_output_summary' ? buildShareableDocument() : value}
                label={slotKey === 'last_output_summary' ? 'copy shareable summary' : 'copy'}
                size={15}
                className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
              />
            ) : null}
            {history.length > 0 ? (
              <button
                type="button"
                onClick={toggleHistory}
                title="View history"
                aria-label={`view history for ${SLOT_TITLE[slotKey]}`}
                className={cn(
                  'rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground',
                  historyOpen && 'bg-foreground/5 text-foreground',
                )}
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
            <LensEmptyState
              tone={SLOT_TONE[slotKey]}
              icon={SLOT_ICON[slotKey]}
              title={SLOT_EMPTY_CTA[slotKey]}
              description={SLOT_EMPTY_DESCRIPTION}
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
                if (isSummarizing) {
                  return;
                }
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setEditing(true);
                }
              }}
              className={cn(
                'rounded-lg leading-relaxed transition-colors [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/15 [&_pre]:whitespace-pre-wrap',
                isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/[0.02]',
              )}
            >
              <Markdown text={value} />
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
        </>
      </PaneShell>
    </InspectorSplit>
  );
};
