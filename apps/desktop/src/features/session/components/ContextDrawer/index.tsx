import { useEffect, useMemo, useState } from 'react';
import { Code } from 'lucide-react';
import {
  Button,
  CopyButton,
  DrawerFrame,
  ScrollFade,
  SegmentedTabs,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { parseDecisions } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
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
import {
  decisionChangesSince,
  hasDecisionChanges,
} from '../../../../store/slices/contextDrawer/decisionChangesSince';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shareableContext } from '../../context/shareableContext';
import { CONTEXT_TABS, CONTEXT_TAB_LABEL, CONTEXT_TAB_SLOT } from './contextTabs';
import { GoalTab } from './GoalTab';
import { DecisionsSection } from './DecisionsSection';
import { SummarySection } from './SummarySection';
import { VersionsView } from './VersionsView';
import { StatusLine } from './StatusLine';
import { ContextLoadFailure } from './ContextLoadFailure';
import { DecisionsBadge } from './DecisionsBadge';

type SlotValueParams = {
  readonly slots: ReturnType<typeof useSessionSlots>;
  readonly key: string;
};

const NO_HIGHLIGHT: ReadonlyArray<number> = [];

const slotValue = ({ slots, key }: SlotValueParams): string =>
  slots.find((slot) => slot.key === key)?.value ?? '';

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
  const slotKey = CONTEXT_TAB_SLOT[tab];
  const historyCount = useSlotHistoryCount(sessionId, slotKey);
  const [isRawEditing, setIsRawEditing] = useState(false);

  const goal = slotValue({ slots, key: 'goal' });
  const decisions = slotValue({ slots, key: 'decisions' });
  const summary = slotValue({ slots, key: 'last_output_summary' });
  const value = slotValue({ slots, key: slotKey });
  const ledger = useAppStore((state) => state.sessionDecisions[sessionId]);
  const decisionCount = useMemo(
    () =>
      ledger === undefined
        ? parseDecisions({ text: decisions }).rows.length
        : ledger.filter((row) => row.status === 'active').length,
    [decisions, ledger],
  );
  const changes = useMemo(
    () => decisionChangesSince({ ledger, since: baseline }),
    [baseline, ledger],
  );
  const hasChanges = hasDecisionChanges(changes);
  const hasSlot = slots.some((slot) => slot.key === slotKey);
  const isLoading = !hasSlot && (loading.slots || slotsLoad === null);
  const hasFailed = !hasSlot && !isLoading && slotsLoad === 'failed';
  const isLocked = summarizer.status === 'running';

  useEffect(() => {
    void ensureSessionSlots(sessionId);
    void loadSessionOpenQuestions(sessionId);
    void loadSessionContextSeen(sessionId);
  }, [ensureSessionSlots, loadSessionContextSeen, loadSessionOpenQuestions, sessionId]);

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
    setIsRawEditing(false);
  }, [tab, view]);

  const openQuestionTexts = useMemo(
    () =>
      openQuestions
        .filter((question) => question.status === 'open')
        .map((question) => question.text),
    [openQuestions],
  );
  const brief = shareableContext({ goal, decisions, summary, openQuestions: openQuestionTexts });

  const options: ReadonlyArray<SegmentedTabOption<ContextDrawerTab>> = CONTEXT_TABS.map(
    (candidate) => ({
      value: candidate,
      label: CONTEXT_TAB_LABEL[candidate],
      ...(candidate === 'decisions' &&
        (decisionCount > 0 || hasChanges) && {
          badge: <DecisionsBadge count={decisionCount} hasChanges={hasChanges} />,
        }),
    }),
  );

  const selectTab = (next: ContextDrawerTab) => {
    openContextDrawer({ sessionId, tab: next });
  };

  const onWrite = (next: string) => {
    void upsertSessionSlot(sessionId, slotKey, next);
  };

  const body = (() => {
    if (view === 'versions') {
      return (
        <VersionsView
          sessionId={sessionId}
          slotKey={slotKey}
          backLabel={CONTEXT_TAB_LABEL[tab]}
          onBack={() => openContextDrawer({ sessionId, tab, view: 'current' })}
        />
      );
    }
    if (hasFailed) {
      return (
        <ContextLoadFailure
          title={CONTEXT_TAB_LABEL[tab]}
          onRetry={() => void loadSessionSlots(sessionId)}
        />
      );
    }
    if (tab === 'goal') {
      return (
        <GoalTab
          sessionId={sessionId}
          value={goal}
          historyCount={historyCount}
          isLoading={isLoading}
          isLocked={isLocked}
          onOpenVersions={() => openContextDrawer({ sessionId, tab, view: 'versions' })}
        />
      );
    }
    if (tab === 'decisions') {
      return (
        <DecisionsSection
          sessionId={sessionId}
          changes={changes}
          highlight={highlight}
          isLocked={isLocked}
          isRawEditing={isRawEditing}
          sourceValue={value}
          onWriteSource={onWrite}
          onCloseRawEditor={() => setIsRawEditing(false)}
        />
      );
    }
    if (value.trim() === '' && !isLoading && !isRawEditing) {
      return (
        <p className="text-body text-muted-foreground">
          A summary appears after the first agent turn.
        </p>
      );
    }
    return (
      <SummarySection
        openQuestions={openQuestionTexts}
        value={value}
        isLoading={isLoading}
        isLocked={isLocked}
        isRawEditing={isRawEditing}
        onWrite={onWrite}
        onCloseRawEditor={() => setIsRawEditing(false)}
      />
    );
  })();

  const isEditableTab = tab !== 'goal' && view === 'current';

  return (
    <DrawerFrame
      title="Context"
      icon={CONCEPT_ICONS.context}
      iconClassName="text-muted-foreground"
      closeLabel="Close context"
      onClose={
        view === 'versions' ? () => openContextDrawer({ sessionId, tab, view: 'current' }) : onClose
      }
      scroll="self"
      action={
        brief === '' ? null : (
          <CopyButton
            presentation="icon"
            value={brief}
            label="Copy as brief"
            size={ICON_SIZE.row}
          />
        )
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
        <SegmentedTabs
          size="sm"
          ariaLabel="Context"
          options={options}
          value={tab}
          onChange={selectTab}
        />
        {tab === 'goal' ? null : <StatusLine sessionId={sessionId} />}
      </div>
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-4 py-3" fadeSize={24}>
        <div className="flex flex-col gap-4">
          {body}
          {isEditableTab ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                disabled={isLocked}
                aria-pressed={isRawEditing}
                onClick={() => setIsRawEditing(!isRawEditing)}
              >
                <Code size={ICON_SIZE.row} aria-hidden />
                {isRawEditing ? 'Done' : 'Edit source'}
              </Button>
              {historyCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openContextDrawer({ sessionId, tab, view: 'versions' })}
                >
                  {`Versions ${historyCount}`}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </ScrollFade>
    </DrawerFrame>
  );
};
