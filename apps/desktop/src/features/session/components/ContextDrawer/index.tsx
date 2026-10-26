import { useEffect, useMemo, useRef, useState } from 'react';
import { BandStack, CopyButton, DrawerFrame, ICON_SIZE, ScrollFade } from '@goodboy/ui';
import { activeDecisionsNewestFirst } from '@goodboy/core';
import type { SessionContextItem, SessionDecision, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionSlots,
  useSessionSlotsLoad,
  useSlotHistoryCount,
  useSummarizerStatus,
} from '../../../../store';
import type { ContextDrawerTab, ContextDrawerView } from '../../../../store/slices/drawer/state';
import { decisionChangesSince } from '../../../../store/slices/contextDrawer/decisionChangesSince';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { shareableContext } from '../../context/shareableContext';
import { CONTEXT_TAB_LABEL, CONTEXT_TAB_SLOT, type ContextSlotTab } from './contextTabs';
import { GoalTab } from './GoalTab';
import { DecisionsSection } from './DecisionsSection';
import { SummarySection } from './SummarySection';
import { VersionsView } from './VersionsView';
import { ContextUpdates } from './ContextUpdates';
import { ContextLoadFailure } from './ContextLoadFailure';
import { ContextSection } from './ContextSection';
import { SlotSourceActions } from './SlotSourceActions';
import { slotVisibility, youOnlyVisibility } from './roleVisibility';
import { LearnedTab } from './LearnedTab';
import { useLearningList } from '../../../../shared/hooks/useLearningList';

type SlotValueParams = {
  readonly slots: ReturnType<typeof useSessionSlots>;
  readonly key: string;
};

const NO_HIGHLIGHT: ReadonlyArray<number> = [];
const NO_PENDING_REMOVALS: ReadonlySet<number> = new Set();
const NO_ITEMS: ReadonlyArray<SessionContextItem> = [];
const NO_DECISIONS: ReadonlyArray<SessionDecision> = [];

const slotValue = ({ slots, key }: SlotValueParams): string =>
  slots.find((slot) => slot.key === key)?.value ?? '';

type SectionParams = {
  readonly section: ContextSlotTab;
};

type WriteParams = SectionParams & {
  readonly next: string;
};

type Props = {
  readonly sessionId: SessionId;
  readonly tab: ContextDrawerTab;
  readonly view: ContextDrawerView;
  readonly highlight?: ReadonlyArray<number>;
  readonly onClose: () => void;
};

export const ContextDrawer = ({
  sessionId,
  tab,
  view,
  highlight = NO_HIGHLIGHT,
  onClose,
}: Props) => {
  const slots = useSessionSlots(sessionId);
  const loading = useSessionLoading(sessionId);
  const slotsLoad = useSessionSlotsLoad(sessionId);
  const openQuestions = useSessionOpenQuestions(sessionId);
  const summarizer = useSummarizerStatus(sessionId);
  const baseline = useAppStore((state) => state.sessionDecisionsBaseline[sessionId]);
  const openContextDrawer = useAppStore((state) => state.openContextDrawer);
  const ensureSessionSlots = useAppStore((state) => state.ensureSessionSlots);
  const loadSessionSlots = useAppStore((state) => state.loadSessionSlots);
  const loadSessionDecisions = useAppStore((state) => state.loadSessionDecisions);
  const loadSessionOpenQuestions = useAppStore((state) => state.loadSessionOpenQuestions);
  const loadSessionContextSeen = useAppStore((state) => state.loadSessionContextSeen);
  const markSessionContextSeen = useAppStore((state) => state.markSessionContextSeen);
  const upsertSessionSlot = useAppStore((state) => state.upsertSessionSlot);
  const versionsTab: ContextSlotTab = tab === 'learned' ? 'summary' : tab;
  const learnings = useAppStore((state) => state.sessionContextItems[sessionId] ?? NO_ITEMS);
  const loadSessionContextItems = useAppStore((state) => state.loadSessionContextItems);
  const learningList = useLearningList({ items: learnings });
  const goalHistory = useSlotHistoryCount(sessionId, CONTEXT_TAB_SLOT.goal);
  const decisionsHistory = useSlotHistoryCount(sessionId, CONTEXT_TAB_SLOT.decisions);
  const summaryHistory = useSlotHistoryCount(sessionId, CONTEXT_TAB_SLOT.summary);
  const [rawTab, setRawTab] = useState<ContextSlotTab | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<ReadonlySet<number>>(NO_PENDING_REMOVALS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const goal = slotValue({ slots, key: 'goal' });
  const decisions = slotValue({ slots, key: 'decisions' });
  const summary = slotValue({ slots, key: 'last_output_summary' });
  const ledger = useAppStore((state) => state.sessionDecisions[sessionId]);
  const changes = useMemo(
    () => decisionChangesSince({ ledger, since: baseline }),
    [baseline, ledger],
  );
  const activeDecisionCount = useMemo(
    () => activeDecisionsNewestFirst({ ledger: ledger ?? NO_DECISIONS }).length,
    [ledger],
  );
  const hasSlots = slots.length > 0;
  const isLoading = !hasSlots && (loading.slots || slotsLoad === null);
  const hasFailed = !hasSlots && !isLoading && slotsLoad === 'failed';
  const isLocked = summarizer.status === 'running';

  useEffect(() => {
    void ensureSessionSlots(sessionId);
    void loadSessionOpenQuestions(sessionId);
    void loadSessionContextSeen(sessionId);
    void loadSessionContextItems({ sessionId });
  }, [
    ensureSessionSlots,
    loadSessionContextItems,
    loadSessionContextSeen,
    loadSessionOpenQuestions,
    sessionId,
  ]);

  const hasLedger = ledger !== undefined;
  useEffect(() => {
    if (hasLedger) {
      return;
    }
    void loadSessionDecisions(sessionId);
  }, [hasLedger, loadSessionDecisions, sessionId]);

  useEffect(() => {
    void markSessionContextSeen(sessionId);
    return () => {
      void markSessionContextSeen(sessionId);
    };
  }, [markSessionContextSeen, sessionId]);

  useEffect(() => {
    setRawTab(null);
  }, [view]);

  useEffect(() => {
    if (view !== 'current') {
      return;
    }
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-context-section="${tab}"]`);
    if (target === null || target === undefined || typeof target.scrollIntoView !== 'function') {
      return;
    }
    target.scrollIntoView({ block: 'start' });
  }, [tab, view]);

  const openQuestionTexts = useMemo(
    () =>
      openQuestions
        .filter((question) => question.status === 'open')
        .map((question) => question.text),
    [openQuestions],
  );
  const brief = shareableContext({ goal, decisions, summary, openQuestions: openQuestionTexts });

  const openVersions = ({ section }: SectionParams) =>
    openContextDrawer({ sessionId, tab: section, view: 'versions' });

  const writeSlot = ({
    section,
    next,
  }: {
    readonly section: ContextSlotTab;
    readonly next: string;
  }) => {
    void upsertSessionSlot(sessionId, CONTEXT_TAB_SLOT[section], next);
  };

  const toggleRaw = ({ section }: SectionParams) =>
    setRawTab((current) => (current === section ? null : section));

  const visibilityOf = ({ section }: SectionParams) =>
    slotVisibility({ slot: CONTEXT_TAB_SLOT[section] });

  const sections = (() => {
    if (view === 'versions') {
      return (
        <VersionsView
          sessionId={sessionId}
          slotKey={CONTEXT_TAB_SLOT[versionsTab]}
          backLabel={CONTEXT_TAB_LABEL[versionsTab]}
          onBack={() => openContextDrawer({ sessionId, tab: versionsTab, view: 'current' })}
        />
      );
    }
    if (hasFailed) {
      return (
        <ContextLoadFailure
          title={NAMES.context}
          onRetry={() => void loadSessionSlots(sessionId)}
        />
      );
    }
    return (
      <>
        <GoalTab
          sessionId={sessionId}
          value={goal}
          historyCount={goalHistory}
          isLoading={isLoading}
          isLocked={isLocked}
          visibility={visibilityOf({ section: 'goal' })}
          onOpenVersions={() => openVersions({ section: 'goal' })}
        />
        <ContextSection
          section="decisions"
          count={activeDecisionCount}
          visibility={visibilityOf({ section: 'decisions' })}
          action={
            <SlotSourceActions
              isLocked={isLocked}
              isRawEditing={rawTab === 'decisions'}
              historyCount={decisionsHistory}
              onToggleRaw={() => toggleRaw({ section: 'decisions' })}
              onOpenVersions={() => openVersions({ section: 'decisions' })}
            />
          }
        >
          <DecisionsSection
            sessionId={sessionId}
            changes={changes}
            highlight={highlight}
            isLocked={isLocked}
            isRawEditing={rawTab === 'decisions'}
            sourceValue={decisions}
            onWriteSource={(next) => writeSlot({ section: 'decisions', next })}
            onCloseRawEditor={() => setRawTab(null)}
            pendingRemovals={pendingRemovals}
            onMarkRemoved={(number) =>
              setPendingRemovals((current) => new Set(current).add(number))
            }
            onUnmarkRemoved={(number) =>
              setPendingRemovals((current) => {
                const next = new Set(current);
                next.delete(number);
                return next;
              })
            }
            onClearRemovals={() => setPendingRemovals(NO_PENDING_REMOVALS)}
          />
        </ContextSection>
        <ContextSection
          section="summary"
          visibility={visibilityOf({ section: 'summary' })}
          action={
            <SlotSourceActions
              isLocked={isLocked}
              isRawEditing={rawTab === 'summary'}
              historyCount={summaryHistory}
              onToggleRaw={() => toggleRaw({ section: 'summary' })}
              onOpenVersions={() => openVersions({ section: 'summary' })}
            />
          }
        >
          {summary.trim() === '' && !isLoading && rawTab !== 'summary' ? (
            <p className="text-body text-muted-foreground">
              A summary appears after the first agent turn.
            </p>
          ) : (
            <SummarySection
              openQuestions={openQuestionTexts}
              value={summary}
              isLoading={isLoading}
              isLocked={isLocked}
              isRawEditing={rawTab === 'summary'}
              onWrite={(next) => writeSlot({ section: 'summary', next })}
              onCloseRawEditor={() => setRawTab(null)}
            />
          )}
        </ContextSection>
        <ContextSection
          section="learned"
          count={learningList.visible.length}
          visibility={youOnlyVisibility()}
        >
          <LearnedTab list={learningList} />
        </ContextSection>
      </>
    );
  })();

  return (
    <DrawerFrame
      title="Context"
      icon={CONCEPT_ICONS.context}
      iconClassName="text-muted-foreground"
      closeLabel={view === 'versions' ? 'Back to current' : 'Close'}
      onClose={
        view === 'versions'
          ? () => openContextDrawer({ sessionId, tab: versionsTab, view: 'current' })
          : onClose
      }
      scroll="self"
      action={
        brief === '' ? null : (
          <CopyButton
            presentation="icon"
            value={brief}
            label={NAMES.copyContext}
            size={ICON_SIZE.row}
            className="size-7 justify-center p-0"
          />
        )
      }
    >
      <div className="shrink-0 px-2 pt-1">
        <ContextUpdates sessionId={sessionId} />
      </div>
      <ScrollFade
        className="min-h-0 flex-1"
        viewportClassName="px-4 py-3"
        viewportRef={scrollRef}
        fadeSize={24}
      >
        <BandStack>{sections}</BandStack>
      </ScrollFade>
    </DrawerFrame>
  );
};
