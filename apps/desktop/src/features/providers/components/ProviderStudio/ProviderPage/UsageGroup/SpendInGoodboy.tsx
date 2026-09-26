import { useEffect } from 'react';
import type { ProviderId } from '@goodboy/types';
import { BAND_ROW_CLASS, Button, cn, formatUsd } from '@goodboy/ui';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '../../../../../../store';
import { openImpactStudio } from '../../../../../impact/openImpactStudio';
import { useProviderSpendPeriods } from '../../../../hooks/useProviderSpendPeriods';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { SpendStat } from './SpendStat';

type Props = {
  readonly providerId: ProviderId;
};

type BudgetParams = {
  readonly capUsd: number;
  readonly spentUsd: number;
};

const budgetText = ({ capUsd, spentUsd }: BudgetParams): string => {
  const used = capUsd <= 0 ? 0 : Math.round((spentUsd / capUsd) * 100);
  return `Budget ${formatUsd(capUsd)} a month, ${used}% used`;
};

export const SpendInGoodboy = ({ providerId }: Props) => {
  const periods = useProviderSpendPeriods({ providerId });
  const rules = useAppStore((state) => state.budgetRules);
  const loadBudgetRules = useAppStore((state) => state.loadBudgetRules);
  const rule = rules.find((candidate) => candidate.provider === providerId) ?? null;
  const openImpact = () => openImpactStudio({ scope: { kind: 'provider', provider: providerId } });

  useEffect(() => {
    void loadBudgetRules().catch(() => undefined);
  }, [loadBudgetRules]);

  return (
    <section
      aria-label="Spend in Goodboy"
      className={cn(BAND_ROW_CLASS, 'flex-wrap gap-x-4 bg-muted text-label')}
    >
      <span className="text-muted-foreground">Spent in Goodboy</span>
      <SpendStat label="Today" value={formatUsd(periods?.todayUsd ?? 0)} />
      <SpendStat label="7 days" value={formatUsd(periods?.last7DaysUsd ?? 0)} />
      <SpendStat label="This month" value={formatUsd(periods?.thisMonthUsd ?? 0)} />
      {rule === null ? null : (
        <span className="tabular-nums text-muted-foreground">
          {budgetText({ capUsd: rule.capUsd, spentUsd: periods?.thisMonthUsd ?? 0 })}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={openImpact} className="ml-auto">
        Open in Impact
        <ArrowRight size={ICON_SIZE.row} aria-hidden />
      </Button>
    </section>
  );
};
