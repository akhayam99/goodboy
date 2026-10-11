const GROUP_FROM = 6;

type Params = {
  readonly starredCount: number;
  readonly total: number;
};

export const shouldGroupStarred = ({ starredCount, total }: Params): boolean =>
  starredCount > 0 && total >= GROUP_FROM;
