import { formatInteger } from '../../../../shared/utils/formatInteger';

type Params = {
  readonly count: number;
};

export const fileCountLabel = ({ count }: Params): string =>
  `${formatInteger(count)} ${count === 1 ? 'file' : 'files'}`;
