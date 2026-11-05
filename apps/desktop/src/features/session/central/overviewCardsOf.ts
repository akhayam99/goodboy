import { NAMES } from '../../../shared/utils/names';
import type { ActionCardModel } from './next/actionCardsOf';
import { nextRowCountOf } from './next/nextRowCountOf';

type OverviewCardId = 'needs-you' | 'running' | 'branches' | 'done';

export type OverviewCardModel = Readonly<{
  id: OverviewCardId;
  title: string;
  count: number;
}>;

const TITLE: Readonly<Record<OverviewCardId, string>> = {
  'needs-you': NAMES.needsYou,
  running: NAMES.running,
  branches: NAMES.branches,
  done: NAMES.done,
};

const MIN_BRANCHES_FOR_CARD = 2;

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly waitingCount: number;
  readonly runningCount: number;
  readonly stuckCount: number;
  readonly branchCount: number;
  readonly doneCount: number;
  readonly isArchived: boolean;
};

export const overviewCardsOf = ({
  cards,
  waitingCount,
  runningCount,
  stuckCount,
  branchCount,
  doneCount,
  isArchived,
}: Params): ReadonlyArray<OverviewCardModel> => {
  if (isArchived) {
    return doneCount > 0 ? [{ id: 'done', title: TITLE.done, count: doneCount }] : [];
  }
  const nextSteps = nextRowCountOf({ cards, card: 'branches' });
  const hasBranchesCard = branchCount >= MIN_BRANCHES_FOR_CARD || nextSteps > 0;
  const counts: ReadonlyArray<readonly [OverviewCardId, boolean, number]> = [
    ['needs-you', true, waitingCount + nextRowCountOf({ cards, card: 'needs-you' })],
    ['branches', hasBranchesCard, branchCount],
    ['running', runningCount > 0 || stuckCount > 0, runningCount],
    ['done', doneCount > 0, doneCount],
  ];
  return counts.flatMap(([id, isShown, count]) =>
    isShown ? [{ id, title: TITLE[id], count }] : [],
  );
};
