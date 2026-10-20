import { formatUsd, type FactCardSpec, type FactTone } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';

type Params = {
  readonly provider: ProviderId;
  readonly spentUsd: number;
  readonly capUsd: number;
  readonly pctUsed: number;
  readonly reset: string;
};

type ToneParams = {
  readonly pctRemaining: number;
};

const toneOf = ({ pctRemaining }: ToneParams): FactTone =>
  pctRemaining > 20 ? 'warning' : 'danger';

export const usageCardOf = ({
  provider,
  spentUsd,
  capUsd,
  pctUsed,
  reset,
}: Params): FactCardSpec => ({
  title: PROVIDER_LABEL[provider],
  sub: 'Monthly cap, all workspaces',
  facts: [
    { label: 'Spent', value: formatUsd(spentUsd), note: `of ${formatUsd(capUsd)}` },
    { label: 'Used', value: `${pctUsed}%`, tone: toneOf({ pctRemaining: 100 - pctUsed }) },
    { label: 'Resets', value: reset },
  ],
});
