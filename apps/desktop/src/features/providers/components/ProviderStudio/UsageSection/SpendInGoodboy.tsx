import { useEffect } from 'react';
import type { ProviderId } from '@goodboy/types';
import { Button, SectionHeader, formatUsd } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { openImpactStudio } from '../../../../impact/openImpactStudio';
import { useProviderSpendPeriods } from '../../../hooks/useProviderSpendPeriods';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { SpendStat } from './SpendStat';

type Props = {
  readonly providerId: ProviderId;
  readonly hasPlan: boolean;
};

export const SpendInGoodboy = ({ providerId, hasPlan }: Props) => {
  const periods = useProviderSpendPeriods({ providerId });
  const rules = useAppStore((state) => state.budgetRules);
  const loadBudgetRules = useAppStore((state) => state.loadBudgetRules);
  const rule = rules.find((candidate) => candidate.provider === providerId) ?? null;
  const openImpact = () => openImpactStudio({ scope: { kind: 'provider', provider: providerId } });

  useEffect(() => {
    void loadBudgetRules().catch(() => undefined);
  }, [loadBudgetRules]);

  return (
    <section aria-label="Spend in Goodboy" className="flex flex-col gap-2">
      <SectionHeader
        label="Spend in Goodboy"
        action={
          <div className="flex items-center gap-2">
            <span className="text-2xs text-faint-foreground">Counted by Goodboy at API prices</span>
            <Button variant="ghost" size="sm" onClick={openImpact}>
              Open Impact
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-start gap-8">
        <SpendStat label="Today" value={formatUsd(periods?.todayUsd ?? 0)} />
        <SpendStat label="Last 7 days" value={formatUsd(periods?.last7DaysUsd ?? 0)} />
        <SpendStat label="This month" value={formatUsd(periods?.thisMonthUsd ?? 0)} />
        {rule === null ? null : (
          <div className="flex flex-col gap-0.5">
            <span className="text-2xs text-faint-foreground">Budget</span>
            <span className="flex items-center gap-1 text-xs text-foreground">
              <span className="tabular-nums">
                {formatUsd(rule.capUsd)} a month, {formatUsd(periods?.thisMonthUsd ?? 0)} used
              </span>
              <span className="text-faint-foreground">·</span>
              <button
                type="button"
                onClick={openImpact}
                className="text-primary underline-offset-2 hover:underline"
              >
                Edit in Impact
              </button>
            </span>
          </div>
        )}
      </div>
      {hasPlan ? (
        <p className="text-2xs text-faint-foreground">
          Your {PROVIDER_LABEL[providerId]} plan covers this. The figure is what the same tokens
          would cost on the API.
        </p>
      ) : null}
    </section>
  );
};
