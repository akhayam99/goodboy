import type { SessionId } from '@goodboy/types';
import { BranchList } from '../branches/BranchList';
import type { BranchEntry } from '../branches/branchStoryOf';
import type { OverviewCardModel } from '../overviewCardsOf';
import { OverviewCard } from './OverviewCard';

type Props = {
  readonly sessionId: SessionId;
  readonly card: OverviewCardModel;
  readonly entries: ReadonlyArray<BranchEntry>;
};

export const BranchesCard = ({ sessionId, card, entries }: Props) => (
  <OverviewCard card={card} hasHeader={false}>
    <BranchList sessionId={sessionId} entries={entries} />
  </OverviewCard>
);
