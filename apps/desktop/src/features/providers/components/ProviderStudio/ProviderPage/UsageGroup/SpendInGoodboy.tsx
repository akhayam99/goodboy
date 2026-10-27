import { useEffect } from 'react';
import type { ProviderBudgetStatus, ProviderId } from '@goodboy/types';
import { BAND_ROW_CLASS, Button, cn, formatUsd, ICON_SIZE, Tooltip } from '@goodboy/ui';
import { ArrowRight } from 'lucide-react';
import { useAppStore } from '../../../../../../store';
import { openImpactStudio } from '../../../../../impact/openImpactStudio';
import { useProviderBudgetOverview } from '../../../../hooks/useProviderBudgetOverview';
import {
  budgetPctUsed,
  budgetResetLabel,
  budgetScopeNote,
} from '../../../../../budget/providerBudgetView';

type Props = {
  readonly providerId: ProviderId;
  readonly hasImpactLink: boolean;
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

export const SpendInGoodboy = ({ providerId, hasImpactLink }: Props) => {
  const overview = useProviderBudgetOverview({ providerId });
  const status = overview?.status ?? null;
  const loadBudgetRules = useAppStore((state) => state.loadBudgetRules);
  const text = status === null ? null : budgetText({ status });
  const openImpact = () => openImpactStudio({ scope: { kind: 'provider', provider: providerId } });

  useEffect(() => {
    void loadBudgetRules().catch(() => undefined);
  }, [loadBudgetRules]);

  if (!hasImpactLink && text === null) {
    return null;
  }
  return (
    <section
      aria-label="Spend in Goodboy"
      className={cn(BAND_ROW_CLASS, 'flex-wrap gap-x-4 bg-muted text-meta')}
    >
      {status === null || text === null ? null : (
        <Tooltip content={budgetScopeNote({ status })}>
          <span className="tabular-nums text-muted-foreground">{text}</span>
        </Tooltip>
      )}
      {hasImpactLink ? (
        <Button variant="ghost" size="sm" onClick={openImpact} className="ml-auto">
          Open in Impact
          <ArrowRight size={ICON_SIZE.row} aria-hidden />
        </Button>
      ) : null}
    </section>
  );
};
