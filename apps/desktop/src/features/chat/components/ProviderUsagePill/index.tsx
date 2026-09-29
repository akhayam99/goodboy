import { Gauge } from 'lucide-react';
import { cn, formatUsd } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatShortDayMonth } from '../../../../shared/utils/formatShortDayMonth';
import { budgetPctUsed } from '../../../budget/providerBudgetView';

type Props = {
  readonly provider: ProviderId;
};

export const ProviderUsagePill = ({ provider }: Props) => {
  const status = useAppStore((s) => s.providerBudgetStatus[provider]);
  if (status === undefined || status.capUsd === null || status.capUsd <= 0) {
    return null;
  }
  const pctUsed = Math.max(0, Math.min(100, budgetPctUsed({ status })));
  const pctRemaining = 100 - pctUsed;
  if (pctRemaining > 50) {
    return null;
  }
  const tone = (() => {
    if (pctRemaining > 20) {
      return 'text-warning';
    }
    return 'text-danger';
  })();
  const reset = formatShortDayMonth({ iso: status.windowEndMs + 1 }).toLowerCase();
  const tooltip = `${provider}: ${formatUsd(status.spentUsd)} / ${formatUsd(status.capUsd)} used across all workspaces (${pctUsed}%) · resets ${reset}`;
  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-secondary',
        tone,
      )}
    >
      <Gauge size={10} aria-hidden />
      {pctRemaining}% left · {reset}
    </span>
  );
};
