import { Fragment, useEffect, useMemo, useState } from 'react';
import { CopyButton, Divider, GhostActionButton } from '@goodboy/ui';
import { Code, History } from 'lucide-react';
import type { Session, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionSlots,
  useSessionSlotsLoad,
  useSlotHistory,
  useSlotHistoryCount,
  useSummarizerStatus,
} from '../../../../../../store';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import type { ContextLens } from '../../../../lens-surface';
import { InspectorSplit } from '../InspectorSplit';
import { SlotHistoryPanel } from '../SlotHistoryPanel';
import { ContextLoadFailure } from './ContextLoadFailure';
import { ContextSection } from './ContextSection';
import { DecisionsSection } from './DecisionsSection';
import { SummarySection } from './SummarySection';

const REGION_ORDER = ['last_output_summary', 'decisions'] satisfies ReadonlyArray<ContextLens>;

const REGION_TITLE: Record<ContextLens, string> = {
  decisions: 'Decisions',
  last_output_summary: 'Session summary',
};

const REGION_DESCRIPTION: Record<ContextLens, string> = {
  decisions: 'One row per choice already settled along the way.',
  last_output_summary: 'What the session has amounted to so far, block by block.',
};

const REGION_CONCEPT = {
  decisions: 'decisions',
  last_output_summary: 'sessionSummary',
} satisfies Record<ContextLens, 'decisions' | 'sessionSummary'>;

type Props = {
  readonly session: Session;
  readonly initialRegion?: ContextLens;
};

type ValueParams = {
  readonly slots: ReturnType<typeof useSessionSlots>;
  readonly slotKey: ContextLens | 'goal';
};

const valueFor = ({ slots, slotKey }: ValueParams): string =>
  slots.find((slot) => slot.key === slotKey)?.value ?? '';

export const ContextPane = ({ session, initialRegion }: Props) => {
  const sessionId = session.id as SessionId;
  const slots = useSessionSlots(sessionId);
  const loading = useSessionLoading(sessionId);
  const slotsLoad = useSessionSlotsLoad(sessionId);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  const ensureSessionSlots = useAppStore((s) => s.ensureSessionSlots);
  const loadSessionSlots = useAppStore((s) => s.loadSessionSlots);
  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const summarizer = useSummarizerStatus(sessionId);
  const decisionsCount = useSlotHistoryCount(sessionId, 'decisions');
  const summaryCount = useSlotHistoryCount(sessionId, 'last_output_summary');
  const [historyKey, setHistoryKey] = useState<ContextLens | null>(null);
  const [rawKey, setRawKey] = useState<ContextLens | null>(null);
  const openHistory = useSlotHistory(sessionId, historyKey ?? '');

  const historyCounts: Record<ContextLens, number> = {
    decisions: decisionsCount,
    last_output_summary: summaryCount,
  };

  const isLocked = summarizer.status === 'running';

  useEffect(() => {
    void loadSessionOpenQuestions(sessionId);
  }, [loadSessionOpenQuestions, sessionId]);

  useEffect(() => {
    void ensureSessionSlots(sessionId);
  }, [ensureSessionSlots, sessionId]);

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
            renderAsMarkdown
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
      <PaneShell title="Context">
        {REGION_ORDER.map((slotKey, index) => {
          const value = valueFor({ slots, slotKey });
          const title = REGION_TITLE[slotKey];
          const historyCount = historyCounts[slotKey];
          const hasSlot = slots.some((slot) => slot.key === slotKey);
          const isLoading = !hasSlot && (loading.slots || slotsLoad === null);
          const hasFailed = !hasSlot && slotsLoad === 'failed';
          const isRawEditing = rawKey === slotKey;
          const onWrite = (next: string) => {
            void upsertSessionSlot(sessionId, slotKey, next);
          };

          return (
            <Fragment key={slotKey}>
              {index > 0 ? <Divider /> : null}
              <ContextSection
                concept={REGION_CONCEPT[slotKey]}
                sectionId={`context-${slotKey}`}
                title={title}
                description={REGION_DESCRIPTION[slotKey]}
                actions={
                  <div className="flex shrink-0 items-center gap-1">
                    <GhostActionButton
                      icon={Code}
                      label={isRawEditing ? 'Done' : 'Edit source'}
                      pressed={isRawEditing}
                      highlighted={isRawEditing}
                      disabled={isLocked}
                      onClick={() => setRawKey(isRawEditing ? null : slotKey)}
                    />
                    {historyCount > 0 ? (
                      <GhostActionButton
                        icon={History}
                        label={`${historyCount} ${historyCount === 1 ? 'version' : 'versions'}`}
                        ariaLabel={`View ${historyCount} previous ${historyCount === 1 ? 'version' : 'versions'} of ${title}`}
                        onClick={() => {
                          void loadSlotHistory(sessionId, slotKey);
                          setHistoryKey(slotKey);
                        }}
                      />
                    ) : null}
                    {value.length > 0 ? (
                      <CopyButton
                        presentation="icon"
                        value={slotKey === 'last_output_summary' ? shareableSummary : value}
                        label={
                          slotKey === 'last_output_summary'
                            ? 'copy shareable summary'
                            : `copy ${title.toLowerCase()}`
                        }
                        size={13}
                      />
                    ) : null}
                  </div>
                }
              >
                {hasFailed ? (
                  <ContextLoadFailure
                    title={title}
                    onRetry={() => {
                      void loadSessionSlots(sessionId);
                    }}
                  />
                ) : slotKey === 'last_output_summary' ? (
                  <SummarySection
                    value={value}
                    isLoading={isLoading}
                    isLocked={isLocked}
                    isRawEditing={isRawEditing}
                    onWrite={onWrite}
                    onCloseRawEditor={() => setRawKey(null)}
                  />
                ) : (
                  <DecisionsSection
                    value={value}
                    isLoading={isLoading}
                    isLocked={isLocked}
                    isRawEditing={isRawEditing}
                    onWrite={onWrite}
                    onCloseRawEditor={() => setRawKey(null)}
                  />
                )}
              </ContextSection>
            </Fragment>
          );
        })}
      </PaneShell>
    </InspectorSplit>
  );
};
