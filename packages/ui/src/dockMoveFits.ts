type Solved = {
  readonly mode: 'push' | 'over';
  readonly isStacked: boolean;
  readonly isDetailOver: boolean;
};

type Params = {
  readonly now: Solved;
  readonly next: Solved;
};

type RankParams = {
  readonly solved: Solved;
};

const rankOf = ({ solved }: RankParams): number => {
  if (solved.mode === 'over') {
    return 2;
  }
  return solved.isStacked ? 1 : 0;
};

export const dockMoveFits = ({ now, next }: Params): boolean =>
  rankOf({ solved: next }) <= rankOf({ solved: now }) &&
  (next.mode === 'over' || !next.isDetailOver || (now.mode === 'push' && now.isDetailOver));
