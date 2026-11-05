import { Fragment, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { HeightMotion, PANE_RHYTHM } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { unreadAgentsOf } from '../../../../store/slices/agents/unreadAgentsOf';
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
import { NewSinceCard } from '../../central/cards/NewSinceCard';
import { doneSummaryOf } from '../../central/cards/doneSummaryOf';
import { latestDoneOf } from '../../central/cards/latestDoneOf';
import { NeedsYouCard } from '../../central/cards/NeedsYouCard';
import { RunningCard } from '../../central/cards/RunningCard';
import { useDoneRows } from '../../central/done/useDoneRows';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import { nextRowCountOf } from '../../central/next/nextRowCountOf';
import { useNextCards } from '../../central/next/useNextCards';
import { useRebaseStopRows } from '../../../history/useRebaseStopRows';
import { useLiveGroups } from '../../central/now/useLiveGroups';
import { liveSectionIdOf } from '../../central/now/liveSectionIdOf';
import { runLeadOf } from '../../central/now/runLeadOf';
import { waitingGroupsOf } from '../../central/now/waitingGroupsOf';
import { useWhereOf } from '../../central/now/useWhereOf';
import { overviewCardsOf, type OverviewCardModel } from '../../central/overviewCardsOf';
import { overviewGlanceOf } from '../../central/overviewGlanceOf';
import { OverviewGlanceLine } from '../../central/summary/OverviewGlanceLine';
import { autoGlanceOf } from '../../../auto/glance/autoGlanceOf';
import { useSessionWorkModel } from '../../central/useSessionWorkModel';

type Props = {
  readonly session: Session;
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

const chipOf = ({ branchLabelOf, mountId }: ChipParams) => {
  const label = branchLabelOf({ mountId });
  return label === null ? null : <BranchChip label={label} />;
};

export const CentralColumn = ({ session }: Props) => {
  const sessionId = session.id;
  const isArchived = session.archivedAt != null;
  const model = useSessionWorkModel({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const clock = useNow(AUTO_CLOCK_MS, model.autoTrees.length > 0);
  const autoTargets = useMemo(
    () => autoRetryTargetsOf({ views: model.autoTrees, agents, now: clock }),
    [agents, clock, model.autoTrees],
  );
  const { cards, actionsFor, openFor } = useNextCards({ session, model, autoTargets });
  const days = useDoneRows({ session, model });
  const groups = useLiveGroups({ model, agents, now: clock });
  const nextCards = useMemo(() => cardsOutsideRunningOf({ cards, groups }), [cards, groups]);
  const { facts } = useBranchFacts({ sessionId, groups });
  const detailByMountId = useBranchDetails({ sessionId, facts });
  const branches = useMemo(
    () => branchEntriesOf({ facts, detailByMountId }),
    [detailByMountId, facts],
  );
  const liveEntries = branches.live;
  const unreadAgents = useAppStore(
    useShallow((state) => unreadAgentsOf({ agents: state.sessionPhaseRuns[sessionId] })),
  );
  const latest = useMemo(() => latestDoneOf({ days, unreadAgents }), [days, unreadAgents]);
  const summary = useMemo(
    () => doneSummaryOf({ finished: branches.finished, days, listedCount: latest.items.length }),
    [branches.finished, days, latest.items.length],
  );
  const branchLabelOf = useBranchLabels({ sessionId });
  const branchNameOf = useBranchNames({ sessionId });
  const whereOf = useWhereOf({ sessionId });
  const branchFor = useCallback(
    ({ card }: CardParams) => branchNameOf({ mountId: card.mountId }),
    [branchNameOf],
  );
  const stopRowFor = useRebaseStopRows({ sessionId });
  const waiting = useMemo(() => waitingGroupsOf({ groups, cards: nextCards }), [groups, nextCards]);
  const stuckCount = groups.filter((group) => liveSectionIdOf({ group }) === 'stopped').length;
  const rootTurns = useAppStore(
    useShallow((state) =>
      model.autoTrees.map((view) => state.agentTurnState[view.tree.rootAgentId]),
    ),
  );
  const autoGlances = useMemo(
    () =>
      model.autoTrees.map((view, index) =>
        autoGlanceOf({ view, rootTurn: rootTurns[index] ?? null }),
      ),
    [model.autoTrees, rootTurns],
  );
  const shown = overviewCardsOf({
    cards: nextCards,
    waitingCount: waiting.length,
    runningCount: groups.filter((group) => liveSectionIdOf({ group }) === 'running').length,
    stuckCount,
    branchCount: liveEntries.length,
    doneCount: summary.count,
    isArchived,
  });
  const hasNeedsYouRows = nextRowCountOf({ cards: nextCards, card: 'needs-you' }) > 0;
  const leadRunId = hasNeedsYouRows ? null : runLeadOf({ groups });

  const cardViewOf = ({ card }: CardViewParams) => {
    switch (card.id) {
      case 'needs-you':
        return (
          <NeedsYouCard
            key={card.id}
            session={session}
            card={card}
            waiting={waiting}
            leadRunId={leadRunId}
            cards={nextCards}
            whereOf={whereOf}
            actionsFor={actionsFor}
            openFor={openFor}
            chipFor={({ card: row }) => chipOf({ branchLabelOf, mountId: row.mountId })}
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
            model={model}
            whereOf={whereOf}
            leadRunId={leadRunId}
          />
        );
      case 'branches':
        return (
          <BranchesCard
            key={card.id}
            sessionId={sessionId}
            card={card}
            entries={liveEntries}
            cards={nextCards}
            canLead={!hasNeedsYouRows && leadRunId === null}
            actionsFor={actionsFor}
            openFor={openFor}
            chipFor={({ card: row }) => chipOf({ branchLabelOf, mountId: row.mountId })}
            branchFor={branchFor}
            stopRowFor={stopRowFor}
          />
        );
      case 'done':
        return (
          <DoneCard
            key={card.id}
            sessionId={sessionId}
            card={card}
            summary={summary}
            latest={latest}
            entries={model.entries}
          />
        );
      default: {
        const exhaustive: never = card.id;
        return exhaustive;
      }
    }
  };

  return (
    <div data-central-column className={PANE_RHYTHM.groups}>
      {isArchived ? null : (
        <OverviewGlanceLine glance={overviewGlanceOf({ cards: shown, stuckCount, autoGlances })} />
      )}
      {shown.map((card) => (
        <Fragment key={card.id}>
          {card.id === 'needs-you' ? (
            <HeightMotion>{cardViewOf({ card })}</HeightMotion>
          ) : (
            cardViewOf({ card })
          )}
          {card.id === 'needs-you' ? (
            <NewSinceCard sessionId={sessionId} latest={latest} entries={model.entries} />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
};
