import { NAMES } from '../../../shared/utils/names';

type Params = {
  readonly count: number;
};

export const mergeLabelOf = ({ count }: Params): string =>
  count > 0 ? `Merge ${count} in order` : NAMES.mergeInOrder;
