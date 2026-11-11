const DOOR_COUNT_CAP = 9;

type Params = {
  readonly count: number;
};

export const countTextOf = ({ count }: Params): string =>
  count > DOOR_COUNT_CAP ? `${DOOR_COUNT_CAP}+` : String(count);
