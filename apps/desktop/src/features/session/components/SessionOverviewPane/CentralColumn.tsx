import { useCallback, useEffect, useMemo } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { autoRetryTargetsOf } from '../../../auto/autoRetryTargetsOf';
import { BranchChip } from '../../central/branches/BranchChip';
import { branchEntriesOf } from '../../central/branches/branchStoryOf';
import { useBranchDetails } from '../../central/branches/useBranchDetails';
import { useBranchFacts } from '../../central/branches/useBranchFacts';
import { useBranchLabels, type BranchLabelOf } from '../../central/branches/useBranchLabels';
import { useBranchNames } from '../../central/branches/useBranchNames';
import { BranchesCard } from '../../central/cards/BranchesCard';
import { cardsOutsideRunningOf } from '../../central/cards/cardsOutsideRunningOf';
import { DoneCard } from '../../central/cards/DoneCard';
import { doneSummaryOf } from '../../central/cards/doneSummaryOf';
import { NextRowsCard } from '../../central/cards/NextRowsCard';
import { RunningCard } from '../../central/cards/RunningCard';
import { useDoneRows } from '../../central/done/useDoneRows';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import { useNextCards } from '../../central/next/useNextCards';
import { useRebaseStopRows } from '../../../history/useRebaseStopRows';
import { liveGroupsOf } from '../../central/now/liveGroupsOf';
import { runLeadOf } from '../../central/now/runLeadOf';
import { useWhereOf } from '../../central/now/useWhereOf';
import { overviewCardsOf, type OverviewCardModel } from '../../central/overviewCardsOf';
import { useSessionWorkModel } from '../../central/useSessionWorkModel';

type LeadChange = {
  readonly hasLead: boolean;
};

type Props = {
  readonly session: Session;
  readonly onLeadChange: (change: LeadChange) => void;
};

type ChipParams = {
  readonly branchLabelOf: BranchLabelOf;
  readonly mountId: string | null;
};

const AUTO_CLOCK_MS = 15_000;

type CardParams = {
  readonly card: ActionCardModel;
};

type CardViewParams = {
  readonly card: OverviewCardModel;
};

type NameParams = CardParams & {
  readonly branchLabelOf: BranchLabelOf;
};

const nameOf = ({ branchLabelOf, card }: NameParams): string | null => {
  const { source } = card;
  if (source.kind === 'auto' && source.target.plan !== null) {
    return source.target.plan.name;
  }
  return branchLabelOf({ mountId: card.mountId })?.branch ?? null;
};

const chipOf = ({ branchLabelOf, mountId }: ChipParams) => {
  const label = branchLabelOf({ mountId });
  return label === null ? null : <BranchChip label={label} />;
};

export const CentralColumn = ({ session, onLeadChange }: Props) => {
  const sessionId = session.id;
  const isArchived = session.archivedAt != null;
  const model = useSessionWorkModel({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const clock = useNow(AUTO_CLOCK_MS, true);
  const autoTargets = useMemo(
    () => autoRetryTargetsOf({ views: model.autoTrees, agents, now: clock }),
    [agents, clock, model.autoTrees],
  );
  const { cards, actionsFor, openFor } = useNextCards({ session, model, autoTargets });
  const days = useDoneRows({ session, model });
  const groups = useMemo(() => liveGroupsOf({ model, agents, now: clock }), [agents, clock, model]);
  const nextCards = useMemo(() => cardsOutsideRunningOf({ cards, groups }), [cards, groups]);
  const { facts } = useBranchFacts({ sessionId, groups });
  const detailByMountId = useBranchDetails({ sessionId, facts });
  const branches = useMemo(
    () => branchEntriesOf({ facts, detailByMountId }),
    [detailByMountId, facts],
  );
  const liveEntries = branches.live;
  const summary = useMemo(
    () => doneSummaryOf({ finished: branches.finished, days }),
    [branches.finished, days],
  );
  const branchLabelOf = useBranchLabels({ sessionId });
  const branchNameOf = useBranchNames({ sessionId });
  const whereOf = useWhereOf({ sessionId });
  const branchFor = useCallback(
    ({ card }: CardParams) => branchNameOf({ mountId: card.mountId }),
    [branchNameOf],
  );
  const stopRowFor = useRebaseStopRows({ sessionId });
  const hasLead = !isArchived && nextCards.length > 0;
  const shown = overviewCardsOf({
    cards: nextCards,
    runningCount: groups.length,
    branchCount: liveEntries.length,
    doneCount: summary.count,
    isArchived,
  });
  const hasNeedsYou = shown.some((card) => card.id === 'needs-you');
  const leadRunId = hasNeedsYou ? null : runLeadOf({ groups });

  useEffect(() => {
    onLeadChange({ hasLead });
  }, [hasLead, onLeadChange]);

  const cardViewOf = ({ card }: CardViewParams) => {
    switch (card.id) {
      case 'needs-you':
      case 'next':
        return (
          <NextRowsCard
            key={card.id}
            sessionId={sessionId}
            card={card}
            rows={card.id}
            cards={nextCards}
            canLead={card.id === 'needs-you' || (!hasNeedsYou && leadRunId === null)}
            actionsFor={actionsFor}
            openFor={openFor}
            chipFor={({ card: row }) => chipOf({ branchLabelOf, mountId: row.mountId })}
            nameFor={({ card: row }) => nameOf({ branchLabelOf, card: row })}
            branchFor={branchFor}
            stopRowFor={stopRowFor}
          />
        );
      case 'running':
        return (
          <RunningCard
            key={card.id}
            session={session}
            card={card}
            groups={groups}
            cards={cards}
            model={model}
            actionsFor={actionsFor}
            whereOf={whereOf}
            leadRunId={leadRunId}
          />
        );
      case 'branches':
        return (
          <BranchesCard key={card.id} sessionId={sessionId} card={card} entries={liveEntries} />
        );
      case 'done':
        return <DoneCard key={card.id} sessionId={sessionId} card={card} summary={summary} />;
      default: {
        const exhaustive: never = card.id;
        return exhaustive;
      }
    }
  };

  return (
    <div data-central-column className={PANE_RHYTHM.stack}>
      {shown.map((card) => cardViewOf({ card }))}
    </div>
  );
};
