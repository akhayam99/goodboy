import type { ComponentProps, ReactNode } from 'react';
import { EntryWash, useEntryWash } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import type { ActionCardModel } from '../../next/actionCardsOf';
import type { NextBranchName } from '../../next/nextRowCopyOf';
import { NextStackView } from '../../next/NextStackView';
import type { ActionCardActions } from '../../next/useActionCardActions';
import { LiveGroup } from '../../now/LiveGroup';
import type { LiveGroupModel } from '../../now/liveGroupsOf';
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
  const stuck = stuckAutoOf({ groups: waiting, views: autoViews });
  const live =
    waiting.length === 0 ? null : (
      <div data-needs-you-live="" className="flex min-w-0 flex-col gap-1">
        {stuck === null ? null : (
          <StuckActions sessionId={session.id} group={stuck.group} view={stuck.view} />
        )}
        {waiting.map((group) => (
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
