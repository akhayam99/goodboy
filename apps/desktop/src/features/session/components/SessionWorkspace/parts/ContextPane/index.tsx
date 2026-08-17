import { useEffect, useMemo, useState } from 'react';
import { Divider } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionSlots,
  useSlotHistory,
  useSlotHistoryCount,
  useSummarizerStatus,
} from '../../../../../../store';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { InspectorSplit } from '../InspectorSplit';
import { SlotHistoryPanel } from '../SlotHistoryPanel';
import { ContextRegion, type ContextRegionKey } from './ContextRegion';

const REGION_ORDER = ['last_output_summary', 'decisions'] satisfies ReadonlyArray<ContextRegionKey>;

type RegionKey = (typeof REGION_ORDER)[number];

const REGION_TITLE: Record<ContextRegionKey, string> = {
  decisions: 'Decisions',
  last_output_summary: 'Session summary',
  goal: 'Goal',
};

const REGION_DESCRIPTION: Record<ContextRegionKey, string> = {
  decisions: 'Choices already settled along the way.',
  last_output_summary: 'What the session has amounted to so far.',
  goal: 'What this session is meant to achieve.',
};

const REGION_EMPTY: Record<ContextRegionKey, string> = {
  decisions: 'No decisions yet',
  last_output_summary: 'No session summary yet',
  goal: 'No goal yet',
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
  const decisionsCount = useSlotHistoryCount(sessionId, 'decisions');
  const summaryCount = useSlotHistoryCount(sessionId, 'last_output_summary');
  const [historyKey, setHistoryKey] = useState<ContextRegionKey | null>(null);
  const openHistory = useSlotHistory(sessionId, historyKey ?? '');

  const historyCounts: Record<RegionKey, number> = {
    decisions: decisionsCount,
    last_output_summary: summaryCount,
  };

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

  return (
    <InspectorSplit
      open={historyKey != null}
      panel={
        historyKey == null ? null : (
          <SlotHistoryPanel
            label={REGION_TITLE[historyKey]}
            renderAsMarkdown={historyKey !== 'goal'}
            entries={openHistory}
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
        description="The current session summary and the decisions settled along the way."
        measure="reading"
      >
        {REGION_ORDER.map((slotKey, index) => (
          <div key={slotKey} className="contents">
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
              historyCount={historyCounts[slotKey]}
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
