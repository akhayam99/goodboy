import { useEffect, useMemo, useState } from 'react';
import { Divider } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionSlots,
  useSlotHistory,
  useSummarizerStatus,
} from '../../../../../../store';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { InspectorSplit } from '../InspectorSplit';
import { SlotHistoryPanel } from '../SlotHistoryPanel';
import { ContextRegion, type ContextRegionKey } from './ContextRegion';

const REGION_ORDER = [
  'goal',
  'decisions',
  'last_output_summary',
] satisfies ReadonlyArray<ContextRegionKey>;

const REGION_TITLE: Record<ContextRegionKey, string> = {
  goal: 'Goal',
  decisions: 'Decisions',
  last_output_summary: 'Session summary',
};

const REGION_DESCRIPTION: Record<ContextRegionKey, string> = {
  goal: 'What this session is meant to achieve.',
  decisions: 'Choices already settled along the way.',
  last_output_summary: 'What the session has amounted to so far.',
};

const REGION_EMPTY: Record<ContextRegionKey, string> = {
  goal: 'No goal yet',
  decisions: 'No decisions yet',
  last_output_summary: 'No session summary yet',
};

type Props = {
  readonly session: Session;
  readonly initialRegion?: ContextRegionKey;
};

type ValueParams = {
  readonly slots: ReturnType<typeof useSessionSlots>;
  readonly slotKey: ContextRegionKey;
};

const valueFor = ({ slots, slotKey }: ValueParams): string =>
  slots.find((slot) => slot.key === slotKey)?.value ?? '';

export const ContextPane = ({ session, initialRegion }: Props) => {
  const sessionId = session.id as SessionId;
  const slots = useSessionSlots(sessionId);
  const loading = useSessionLoading(sessionId);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const summarizer = useSummarizerStatus(sessionId);
  const goalHistory = useSlotHistory(sessionId, 'goal');
  const decisionsHistory = useSlotHistory(sessionId, 'decisions');
  const summaryHistory = useSlotHistory(sessionId, 'last_output_summary');
  const [historyKey, setHistoryKey] = useState<ContextRegionKey | null>(null);

  const histories = useMemo(
    () => ({
      goal: goalHistory,
      decisions: decisionsHistory,
      last_output_summary: summaryHistory,
    }),
    [decisionsHistory, goalHistory, summaryHistory],
  );

  useEffect(() => {
    void loadSessionOpenQuestions(sessionId);
  }, [loadSessionOpenQuestions, sessionId]);

  useEffect(() => {
    if (initialRegion == null) {
      return;
    }
    document.getElementById(`context-${initialRegion}`)?.scrollIntoView({ block: 'start' });
  }, [initialRegion]);

  const shareableSummary = useMemo(() => {
    const parts: string[] = [];
    const goal = valueFor({ slots, slotKey: 'goal' });
    const decisions = valueFor({ slots, slotKey: 'decisions' });
    const summary = valueFor({ slots, slotKey: 'last_output_summary' });
    if (goal.length > 0) {
      parts.push(`## Goal\n\n${goal}`);
    }
    if (summary.length > 0) {
      parts.push(`## Session summary\n\n${summary}`);
    }
    if (decisions.length > 0) {
      parts.push(`## Decisions\n\n${decisions}`);
    }
    const questions = openQuestions.filter((question) => question.status === 'open');
    if (questions.length > 0) {
      parts.push(
        `## Open questions\n\n${questions.map((question) => `- ${question.text}`).join('\n')}`,
      );
    }
    return parts.join('\n\n');
  }, [openQuestions, slots]);

  const activeHistory = historyKey == null ? [] : histories[historyKey];

  return (
    <InspectorSplit
      open={historyKey != null}
      panel={
        historyKey == null ? null : (
          <SlotHistoryPanel
            label={REGION_TITLE[historyKey]}
            renderAsMarkdown={historyKey !== 'goal'}
            entries={activeHistory}
            onRestore={(entry) => {
              void upsertSessionSlot(sessionId, historyKey, entry.value);
              setHistoryKey(null);
            }}
            onClose={() => setHistoryKey(null)}
          />
        )
      }
    >
      <PaneShell
        title="Context"
        description="The goal, settled decisions, and current session summary."
        measure="reading"
      >
        {REGION_ORDER.map((slotKey, index) => (
          <div key={slotKey} className="flex flex-col gap-6">
            {index > 0 ? <Divider /> : null}
            <ContextRegion
              sessionId={sessionId}
              slotKey={slotKey}
              title={REGION_TITLE[slotKey]}
              description={REGION_DESCRIPTION[slotKey]}
              emptyLabel={REGION_EMPTY[slotKey]}
              value={valueFor({ slots, slotKey })}
              copyValue={
                slotKey === 'last_output_summary' ? shareableSummary : valueFor({ slots, slotKey })
              }
              history={histories[slotKey]}
              isLoading={slots.some((slot) => slot.key === slotKey) === false && loading.slots}
              isSummarizing={summarizer.status === 'running'}
              onOpenHistory={() => {
                void loadSlotHistory(sessionId, slotKey);
                setHistoryKey(slotKey);
              }}
            />
          </div>
        ))}
      </PaneShell>
    </InspectorSplit>
  );
};
