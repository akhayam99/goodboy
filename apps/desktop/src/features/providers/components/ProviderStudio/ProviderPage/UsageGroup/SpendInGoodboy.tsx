import { useEffect } from 'react';
import type { ProviderBudgetStatus, ProviderId } from '@goodboy/types';
import { BAND_ROW_CLASS, Button, cn, formatUsd } from '@goodboy/ui';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '../../../../../../store';
import { openImpactStudio } from '../../../../../impact/openImpactStudio';
import { useProviderBudgetOverview } from '../../../../hooks/useProviderBudgetOverview';
import {
  budgetPctUsed,
  budgetResetLabel,
  budgetScopeNote,
} from '../../../../../budget/providerBudgetView';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { SpendStat } from './SpendStat';

type Props = {
  readonly providerId: ProviderId;
};

type BudgetParams = {
  readonly status: ProviderBudgetStatus;
};

const budgetText = ({ status }: BudgetParams): string | null => {
  if (status.capUsd === null) {
    return null;
  }
  return `Budget ${formatUsd(status.capUsd)} a month, ${budgetPctUsed({ status })}% used across all workspaces, resets ${budgetResetLabel({ status })}`;
};

export const SpendInGoodboy = ({ providerId }: Props) => {
  const overview = useProviderBudgetOverview({ providerId });
  const periods = overview?.periods ?? null;
  const status = overview?.status ?? null;
  const loadBudgetRules = useAppStore((state) => state.loadBudgetRules);
  const text = status === null ? null : budgetText({ status });
  const openImpact = () => openImpactStudio({ scope: { kind: 'provider', provider: providerId } });

  useEffect(() => {
    void loadBudgetRules().catch(() => undefined);
  }, [loadBudgetRules]);

  return (
    <section
      aria-label="Spend in Goodboy"
      className={cn(BAND_ROW_CLASS, 'flex-wrap gap-x-4 bg-muted text-label')}
    >
      <span className="text-muted-foreground">Spent in Goodboy, all workspaces</span>
      <SpendStat label="Today" value={formatUsd(periods?.todayUsd ?? 0)} />
      <SpendStat label="7 days" value={formatUsd(periods?.last7DaysUsd ?? 0)} />
      <SpendStat label="This month" value={formatUsd(periods?.thisMonthUsd ?? 0)} />
      {status === null || text === null ? null : (
        <span className="tabular-nums text-muted-foreground" title={budgetScopeNote({ status })}>
          {text}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={openImpact} className="ml-auto">
        Open in Impact
        <ArrowRight size={ICON_SIZE.row} aria-hidden />
      </Button>
    </section>
  );
};
