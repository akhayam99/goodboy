import { slotValue } from './slotValue';
import { useWriteContextSlot } from './useWriteContextSlot';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BandStack, DrawerFrame, ScrollFade } from '@goodboy/ui';
import { activeDecisionsNewestFirst } from '@goodboy/core/context';
import type { SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionLoading,
  useSessionSlots,
  useSessionSlotsLoad,
  useSlotHistoryCount,
  useSummarizerStatus,
} from '../../../../store';
import type {
  ContextDrawerSection,
  ContextDrawerView,
} from '../../../../store/slices/drawer/state';
import { decisionChangesSince } from '../../../../store/slices/contextDrawer/decisionChangesSince';
import { selectContextBaseline } from '../../../../store/slices/contextDrawer/selectContextBaseline';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { CONTEXT_SECTION_SLOT } from './contextSectionSlots';
import { GoalTab } from './GoalTab';
import { DecisionsSection } from './DecisionsSection';
import { SummarySection } from './SummarySection';
import { SummaryStatus } from './SummaryStatus';
import { usePendingRemovals } from './usePendingRemovals';
import { useContextBrief } from './useContextBrief';
import { VersionsView } from './VersionsView';
import { versionsBackOf } from './versionsBackOf';
import { ContextUpdates } from './ContextUpdates';
import { ContextCopyButton } from './ContextCopyButton';
import { ContextPageFrame } from './ContextPageFrame';
import { ContextLoadFailure } from './ContextLoadFailure';
import { MarkContextRead } from './MarkContextRead';
import { ContextSection } from './ContextSection';
import { slotVisibility, youOnlyVisibility } from './roleVisibility';
import { ExplanationsSection } from './ExplanationsSection';
import { SendsSection } from './SendsSection';
import { useContextLoads } from './useContextLoads';
import { revealContextSection } from './revealContextSection';
import { useLearningList } from '../../../../shared/hooks/useLearningList';

type ContextSlotSection = Exclude<ContextDrawerSection, 'explanations'>;

type SectionParams = {
  readonly section: ContextSlotSection;
};

type Props = {
  readonly sessionId: SessionId;
  readonly section: ContextDrawerSection;
  readonly view: ContextDrawerView;
  readonly highlight?: ReadonlyArray<number>;
  readonly isPage?: boolean;
  readonly cards?: ReactNode;
  readonly onClose: () => void;
};

export const ContextDrawer = ({
  sessionId,
  section,
  view,
  highlight = EMPTY_ARRAY,
  isPage = false,
  cards,
  onClose,
}: Props) => {
  const slots = useSessionSlots(sessionId);
  const loading = useSessionLoading(sessionId);
  const slotsLoad = useSessionSlotsLoad(sessionId);
  const summarizer = useSummarizerStatus(sessionId);
  const baseline = useAppStore((state) => selectContextBaseline({ state, sessionId }));
  const openContextDrawer = useAppStore((state) => state.openContextDrawer);
  const loadSessionSlots = useAppStore((state) => state.loadSessionSlots);
  const writeSlot = useWriteContextSlot({ sessionId });
  const versionsSection: ContextSlotSection = section === 'explanations' ? 'summary' : section;
  const learnings = useAppStore((state) => state.sessionContextItems[sessionId] ?? EMPTY_ARRAY);
  const learningList = useLearningList({ items: learnings });
  const goalHistory = useSlotHistoryCount(sessionId, CONTEXT_SECTION_SLOT.goal);
  const decisionsHistory = useSlotHistoryCount(sessionId, CONTEXT_SECTION_SLOT.decisions);
  const summaryHistory = useSlotHistoryCount(sessionId, CONTEXT_SECTION_SLOT.summary);
  const [rawSection, setRawSection] = useState<ContextSlotSection | null>(null);
  const removals = usePendingRemovals();
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
    () => activeDecisionsNewestFirst({ ledger: ledger ?? EMPTY_ARRAY }).length,
    [ledger],
  );
  const hasSlots = slots.length > 0;
  const isLoading = !hasSlots && (loading.slots || slotsLoad === null);
  const hasFailed = !hasSlots && !isLoading && slotsLoad === 'failed';
  const isLocked = summarizer.status === 'running';

  useContextLoads({ sessionId, hasLedger: ledger !== undefined });

  useEffect(() => {
    setRawSection(null);
  }, [view]);

  useEffect(() => {
    if (view !== 'current') {
      return;
    }
    revealContextSection({ scroller: scrollRef.current, section });
  }, [section, view]);

  const brief = useContextBrief({ sessionId, goal, decisions, summary });

  const openVersions = ({ section }: SectionParams) =>
    openContextDrawer({ sessionId, section: section, view: 'versions' });

  const backToCurrent = () =>
    openContextDrawer({ sessionId, section: versionsSection, view: 'current' });

  const back = versionsBackOf({ view, section: versionsSection, onBack: backToCurrent });

  const toggleRaw = ({ section }: SectionParams) =>
    setRawSection((current) => (current === section ? null : section));

  const visibilityOf = ({ section }: SectionParams) =>
    slotVisibility({ slot: CONTEXT_SECTION_SLOT[section] });

  const sections = (() => {
    if (view === 'versions') {
      return (
        <VersionsView
          sessionId={sessionId}
          slotKey={CONTEXT_SECTION_SLOT[versionsSection]}
          back={isPage ? back : undefined}
          onBack={backToCurrent}
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
          layout={rawSection === 'decisions' ? 'prose' : 'rows'}
          action={<MarkContextRead sessionId={sessionId} changes={changes} />}
          visibility={visibilityOf({ section: 'decisions' })}
          isLocked={isLocked}
          historyCount={decisionsHistory}
          onEdit={() => toggleRaw({ section: 'decisions' })}
          onOpenVersions={() => openVersions({ section: 'decisions' })}
        >
          <DecisionsSection
            sessionId={sessionId}
            changes={changes}
            highlight={highlight}
            isLocked={isLocked}
            isRawEditing={rawSection === 'decisions'}
            sourceValue={decisions}
            onWriteSource={(next) => writeSlot({ section: 'decisions', next })}
            onCloseRawEditor={() => setRawSection(null)}
            pendingRemovals={removals.pending}
            onMarkRemoved={(number) => removals.mark({ number })}
            onUnmarkRemoved={(number) => removals.unmark({ number })}
            onClearRemovals={removals.clear}
          />
        </ContextSection>
        <ContextSection
          section="summary"
          visibility={visibilityOf({ section: 'summary' })}
          isLocked={isLocked}
          historyCount={summaryHistory}
          onEdit={() => toggleRaw({ section: 'summary' })}
          onOpenVersions={() => openVersions({ section: 'summary' })}
        >
          <SummarySection
            value={summary}
            isLoading={isLoading}
            isRawEditing={rawSection === 'summary'}
            onWrite={(next) => writeSlot({ section: 'summary', next })}
            onCloseRawEditor={() => setRawSection(null)}
          />
        </ContextSection>
        {isLoading ? null : <SendsSection sessionId={sessionId} />}
        <ContextSection
          section="explanations"
          count={learningList.visible.length}
          layout="rows"
          visibility={youOnlyVisibility()}
        >
          <ExplanationsSection list={learningList} />
        </ContextSection>
      </>
    );
  })();

  const copy = <ContextCopyButton brief={brief} />;
  const status = view === 'current' ? <SummaryStatus value={summary} /> : null;
  const lead = (
    <>
      {status}
      {cards}
    </>
  );

  if (isPage) {
    return (
      <ContextPageFrame sessionId={sessionId} action={copy} cards={lead} frameRef={scrollRef}>
        {sections}
      </ContextPageFrame>
    );
  }

  return (
    <DrawerFrame
      title={NAMES.context}
      icon={CONCEPT_ICONS.context}
      iconClassName="text-muted-foreground"
      back={back}
      onClose={onClose}
      scroll="self"
      action={copy}
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
        <BandStack>
          {status}
          {sections}
        </BandStack>
      </ScrollFade>
    </DrawerFrame>
  );
};
