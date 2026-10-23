import { NAMES } from '../../../shared/names';
import type { ActionCardModel } from './next/actionCardsOf';
import { nextRowCountOf } from './next/nextRowCountOf';

type OverviewCardId = 'needs-you' | 'running' | 'next' | 'branches' | 'done';

export type OverviewCardModel = Readonly<{
  id: OverviewCardId;
  title: string;
  count: number;
}>;

const TITLE: Readonly<Record<OverviewCardId, string>> = {
  'needs-you': NAMES.needsYou,
  running: NAMES.running,
  next: 'Next',
  branches: NAMES.branches,
  done: NAMES.done,
};

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly runningCount: number;
  readonly branchCount: number;
  readonly doneCount: number;
  readonly isArchived: boolean;
};

export const overviewCardsOf = ({
  cards,
  runningCount,
  branchCount,
  doneCount,
  isArchived,
}: Params): ReadonlyArray<OverviewCardModel> => {
  const counts: ReadonlyArray<readonly [OverviewCardId, number]> = isArchived
    ? [['done', doneCount]]
    : [
        ['needs-you', nextRowCountOf({ cards, card: 'needs-you' })],
        ['running', runningCount],
        ['next', nextRowCountOf({ cards, card: 'next' })],
        ['branches', branchCount],
        ['done', doneCount],
      ];
  return counts.flatMap(([id, count]) => (count > 0 ? [{ id, title: TITLE[id], count }] : []));
};
