import type { Fact } from '@goodboy/ui';
import { pluralize } from '../../../shared/utils/pluralize';
import { formatAskCost } from './askRightNow';

type Params = {
  readonly readCount: number;
  readonly costUsd: number | null;
};

export const askReplyDetail = ({ readCount, costUsd }: Params): ReadonlyArray<Fact> => [
  ...(costUsd === null ? [] : [{ label: 'Cost', value: formatAskCost(costUsd) }]),
  ...(readCount === 0 ? [] : [{ label: 'Read', value: pluralize(readCount, 'file') }]),
];
