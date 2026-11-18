import type { ColumnPlace } from './columnPlace';

type Params = {
  readonly place: ColumnPlace;
};

export const railPlaceOf = ({ place }: Params): Exclude<ColumnPlace, null> =>
  place === null ? 'board' : place;
