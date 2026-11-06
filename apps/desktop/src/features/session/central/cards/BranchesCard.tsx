import type { ComponentProps, ReactNode } from 'react';
import { SectionLabel } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { BranchList } from '../branches/BranchList';
import type { BranchEntry } from '../branches/branchStoryOf';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { NextBranchName } from '../next/nextRowCopyOf';
import { nextRowCountOf } from '../next/nextRowCountOf';
import { NextStackView } from '../next/NextStackView';
import type { ActionCardActions } from '../next/useActionCardActions';
import type { OverviewCardModel } from '../overviewCardsOf';
import { OverviewCard } from './OverviewCard';

type CardParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly sessionId: SessionId;
  readonly card: OverviewCardModel;
  readonly entries: ReadonlyArray<BranchEntry>;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly canLead: boolean;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
  readonly chipFor: (params: CardParams) => ReactNode;
  readonly branchFor: (params: CardParams) => NextBranchName | null;
  readonly stopRowFor: ComponentProps<typeof NextStackView>['stopRowFor'];
};

export const BranchesCard = ({
  sessionId,
  card,
  entries,
  cards,
  canLead,
  actionsFor,
  openFor,
  chipFor,
  branchFor,
  stopRowFor,
}: Props) => (
  <OverviewCard
    card={card}
    hasHeader={false}
    regionLabel={entries.length >= 2 ? undefined : card.title}
  >
    {nextRowCountOf({ cards, card: 'branches' }) > 0 ? (
      <SectionLabel headingLevel={2} label="Next" />
    ) : null}
    <NextStackView
      sessionId={sessionId}
      cards={cards}
      overviewCard="branches"
      hasHeader={false}
      hasGroupLabels={false}
      canLead={canLead}
      actionsFor={actionsFor}
      openFor={openFor}
      chipFor={chipFor}
      branchFor={branchFor}
      stopRowFor={stopRowFor}
    />
    {entries.length >= 2 ? <BranchList sessionId={sessionId} entries={entries} /> : null}
  </OverviewCard>
);
