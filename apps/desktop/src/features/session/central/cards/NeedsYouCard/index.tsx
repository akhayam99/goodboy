import type { ComponentProps, ReactNode } from 'react';
import { EntryWash, useEntryWash } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import type { ActionCardModel } from '../../next/actionCardsOf';
import type { NextBranchName } from '../../next/nextRowCopyOf';
import { NextStackView } from '../../next/NextStackView';
import type { ActionCardActions } from '../../next/useActionCardActions';
import { LiveGroup } from '../../now/LiveGroup';
import type { LiveAutoGroup, LiveGroupModel } from '../../now/liveGroupsOf';
import { LiveAutoAgents } from '../../now/LiveAutoAgents';
import { uncardedGroupsOf } from '../../now/uncardedGroupsOf';
import { cardedAutoRootsOf } from '../../cardedAutoRootsOf';
import { StuckActions } from '../../now/StuckActions';
import { stuckAutoOf } from '../../now/stuckAutoOf';
import type { WhereOf } from '../../now/useWhereOf';
import type { OverviewCardModel } from '../../overviewCardsOf';
import { OverviewCard } from '../OverviewCard';
import { needsYouRowKeysOf } from './needsYouRowKeysOf';

type CardParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly session: Session;
  readonly card: OverviewCardModel;
  readonly waiting: ReadonlyArray<LiveGroupModel>;
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly leadRunId: string | null;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly whereOf: WhereOf;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
  readonly chipFor: (params: CardParams) => ReactNode;
  readonly branchFor: (params: CardParams) => NextBranchName | null;
  readonly stopRowFor: ComponentProps<typeof NextStackView>['stopRowFor'];
};

export const NeedsYouCard = ({
  session,
  card,
  waiting,
  groups,
  autoViews,
  leadRunId,
  cards,
  whereOf,
  actionsFor,
  openFor,
  chipFor,
  branchFor,
  stopRowFor,
}: Props) => {
  const washed = useEntryWash({ keys: needsYouRowKeysOf({ waiting, cards }) });
  if (card.count === 0) {
    return null;
  }
  const carded = cardedAutoRootsOf({ cards });
  const stuck = stuckAutoOf({ groups, views: autoViews });
  const isStuckCarded = stuck !== null && carded.has(stuck.group.group.rootAgentId);
  const rows = uncardedGroupsOf({ groups: waiting, cards });
  const folds = groups.filter(
    (group): group is LiveAutoGroup =>
      group.kind === 'auto' &&
      carded.has(group.group.rootAgentId) &&
      (group.group.isStuck || group.state === 'failed' || waiting.includes(group)),
  );
  const live =
    rows.length === 0 && folds.length === 0 && (stuck === null || isStuckCarded) ? null : (
      <div data-needs-you-live="" className="flex min-w-0 flex-col gap-1">
        {stuck === null || isStuckCarded ? null : (
          <StuckActions sessionId={session.id} group={stuck.group} view={stuck.view} />
        )}
        {rows.map((group) => (
          <EntryWash
            key={`${group.kind}:${group.id}`}
            isWashed={washed.has(`${group.kind}:${group.id}`)}
          >
            <LiveGroup
              sessionId={session.id}
              session={session}
              group={group}
              where={whereOf({ mountId: group.mountId })}
              isLead={group.id === leadRunId}
            />
          </EntryWash>
        ))}
        {folds.map((group) => (
          <LiveAutoAgents key={group.group.rootAgentId} sessionId={session.id} group={group} />
        ))}
      </div>
    );
  const stack = (
    <NextStackView
      sessionId={session.id}
      cards={cards}
      overviewCard="needs-you"
      washedIds={washed}
      hasHeader={false}
      canLead
      isFlat
      actionsFor={actionsFor}
      openFor={openFor}
      chipFor={chipFor}
      branchFor={branchFor}
      stopRowFor={stopRowFor}
    />
  );
  const isStackFirst = leadRunId === null;
  return (
    <OverviewCard card={card}>
      {isStackFirst ? stack : live}
      {isStackFirst ? live : stack}
    </OverviewCard>
  );
};
