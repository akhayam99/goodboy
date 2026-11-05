import { formatUsd } from '@goodboy/ui';

type Params = {
  readonly spentUsd: number;
};

const CENT = 0.005;

export const spendTextOf = ({ spentUsd }: Params): string | null =>
  spentUsd >= CENT ? formatUsd(spentUsd) : null;
