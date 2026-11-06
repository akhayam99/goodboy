import type { BranchEntry } from './branches/branchStoryOf';
import type { OverviewCardModel } from './overviewCardsOf';

type Params = {
  readonly shown: ReadonlyArray<OverviewCardModel>;
  readonly entries: ReadonlyArray<BranchEntry>;
  readonly hasFolders: boolean;
  readonly hasUnassignedNotes: boolean;
  readonly hasClosedWorktree: boolean;
};

type EntryParams = {
  readonly entry: BranchEntry;
};

const isWorkedOn = ({ entry }: EntryParams): boolean => {
  const { fact } = entry;
  return fact.request !== null || fact.liveCount > 0 || (fact.status?.ahead ?? 0) > 0;
};

export const overviewHasContentOf = ({
  shown,
  entries,
  hasFolders,
  hasUnassignedNotes,
  hasClosedWorktree,
}: Params): boolean =>
  hasFolders ||
  hasUnassignedNotes ||
  hasClosedWorktree ||
  shown.some((card) => card.id !== 'needs-you' || card.count > 0) ||
  entries.some((entry) => isWorkedOn({ entry }));
