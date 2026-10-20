import { useEffect } from 'react';
import { Gauge } from 'lucide-react';
import { FactCard, cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatDayMonth } from '../../../../shared/utils/time/formatDayMonth';
import { budgetPctUsed } from '../../../budget/providerBudgetView';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { usageCardOf } from './usageCardOf';

type Props = {
  readonly provider: ProviderId;
};

export const ProviderUsagePill = ({ provider }: Props) => {
  const status = useAppStore((s) => s.providerBudgetStatus[provider]);
  const refreshStatus = useAppStore((s) => s.refreshProviderBudgetStatus);
  const isStale = status !== undefined && Date.now() > status.windowEndMs;

  useEffect(() => {
    if (isStale) {
      void refreshStatus().catch(() => undefined);
    }
  }, [isStale, refreshStatus]);

  if (status === undefined || isStale || status.capUsd === null || status.capUsd <= 0) {
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
  const reset = formatDayMonth({ at: status.windowEndMs + 1 });
  return (
    <FactCard
      card={usageCardOf({
        provider,
        spentUsd: status.spentUsd,
        capUsd: status.capUsd,
        pctUsed,
        reset,
      })}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-chip',
          tone,
        )}
      >
        <Gauge size={ICON_SIZE.mark} aria-hidden />
        {pctRemaining}% left · {reset.toLowerCase()}
      </span>
    </FactCard>
  );
};
