import type { ComponentProps, ReactNode } from 'react';
import { EmptyLine } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import type { ActionCardModel } from '../../next/actionCardsOf';
import type { NextBranchName } from '../../next/nextRowCopyOf';
import { NextStackView } from '../../next/NextStackView';
import type { ActionCardActions } from '../../next/useActionCardActions';
import { LiveGroup } from '../../now/LiveGroup';
import type { LiveGroupModel } from '../../now/liveGroupsOf';
import type { WhereOf } from '../../now/useWhereOf';
import type { OverviewCardModel } from '../../overviewCardsOf';
import { OverviewCard } from '../OverviewCard';

type CardParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly session: Session;
  readonly card: OverviewCardModel;
  readonly waiting: ReadonlyArray<LiveGroupModel>;
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
  leadRunId,
  cards,
  whereOf,
  actionsFor,
  openFor,
  chipFor,
  branchFor,
  stopRowFor,
}: Props) => {
  if (card.count === 0) {
    return (
      <section
        aria-label={card.title}
        data-overview-card={card.id}
        data-needs-you-empty=""
        className="flex h-8 min-w-0 items-center rounded-lg bg-subtle px-4"
      >
        <EmptyLine className="flex-1">Nothing needs you</EmptyLine>
      </section>
    );
  }
  return (
    <OverviewCard card={card}>
      {waiting.length === 0 ? null : (
        <div data-needs-you-live="" className="flex min-w-0 flex-col gap-1">
          {waiting.map((group) => (
            <LiveGroup
              key={`${group.kind}:${group.id}`}
              sessionId={session.id}
              session={session}
              group={group}
              where={whereOf({ mountId: group.mountId })}
              isLead={group.id === leadRunId}
            />
          ))}
        </div>
      )}
      <NextStackView
        sessionId={session.id}
        cards={cards}
        overviewCard="needs-you"
        hasHeader={false}
        canLead
        actionsFor={actionsFor}
        openFor={openFor}
        chipFor={chipFor}
        branchFor={branchFor}
        stopRowFor={stopRowFor}
      />
    </OverviewCard>
  );
};
