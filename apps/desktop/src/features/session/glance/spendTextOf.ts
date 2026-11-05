import { formatUsd } from '@goodboy/ui';

type Params = {
  readonly spentUsd: number;
  readonly capUsd: number | null;
};

const CENT = 0.005;

export const spendTextOf = ({ spentUsd, capUsd }: Params): string | null => {
  if (capUsd !== null) {
    return `${formatUsd(spentUsd)} of ${formatUsd(capUsd)}`;
  }
  return spentUsd >= CENT ? formatUsd(spentUsd) : null;
};
