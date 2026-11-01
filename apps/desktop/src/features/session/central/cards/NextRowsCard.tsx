import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import type { RebaseStopRowFor } from '../../../history/useRebaseStopRows';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { NextBranchName } from '../next/nextRowCopyOf';
import { NextStackView } from '../next/NextStackView';
import type { ActionCardActions } from '../next/useActionCardActions';
import type { OverviewCardModel } from '../overviewCardsOf';
import type { NextOverviewCardId } from './overviewCardOfGroup';
import { OverviewCard } from './OverviewCard';

type CardParams = {
  readonly card: ActionCardModel;
};

type Props = {
  readonly sessionId: SessionId;
  readonly card: OverviewCardModel;
  readonly rows: NextOverviewCardId;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly canLead: boolean;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
  readonly chipFor: (params: CardParams) => ReactNode;
  readonly branchFor: (params: CardParams) => NextBranchName | null;
  readonly stopRowFor: RebaseStopRowFor;
};

export const NextRowsCard = ({
  sessionId,
  card,
  rows,
  cards,
  canLead,
  actionsFor,
  openFor,
  chipFor,
  branchFor,
  stopRowFor,
}: Props) => (
  <OverviewCard card={card}>
    <NextStackView
      sessionId={sessionId}
      cards={cards}
      overviewCard={rows}
      hasHeader={false}
      canLead={canLead}
      actionsFor={actionsFor}
      openFor={openFor}
      chipFor={chipFor}
      branchFor={branchFor}
      stopRowFor={stopRowFor}
    />
  </OverviewCard>
);
