import { useMemo } from 'react';
import { formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { BudgetAlert, TelemetrySummary } from '@goodboy/types';
import type { ProviderSpendEntry } from '../../../../store';
import { brandColor } from '../../../providers/components/provider-brand';
import { AlertBanner } from './AlertBanner';
import { ModelTable } from './ModelTable';
import { PanelShell } from './PanelShell';
import { ProviderIcon } from './ProviderIcon';
import { SpendBar } from './SpendBar';
import { Sparkline } from './Sparkline';
import { StatCard } from './StatCard';
import { TurnsTable } from './TurnsTable';
import { Widget } from './Widget';
import {
  buildModelBreakdown,
  chronologicalTurnCosts,
  formatTokens,
  providerLabel,
  toProviderId,
  type BudgetScope,
  type WorkspaceTurn,
} from './lib';

type Props = {
  readonly workspaceSummary: TelemetrySummary | null;
  readonly providers: ReadonlyArray<ProviderSpendEntry>;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly sessionCount: number;
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly onDismissAlert: (id: string) => void;
  readonly onSelect: (scope: BudgetScope) => void;
};

export function OverviewPanel({
  workspaceSummary,
  providers,
  turns,
  sessionCount,
  alerts,
  onDismissAlert,
  onSelect,
}: Props) {
  const records = useMemo(() => turns.map((t) => t.record), [turns]);
  const workspaceCost = workspaceSummary?.estimatedCostUsd ?? 0;
  const totalTokens = (workspaceSummary?.inputTokens ?? 0) + (workspaceSummary?.outputTokens ?? 0);
  const recordCount = workspaceSummary?.recordCount ?? records.length;
  const avgPerTurn = recordCount > 0 ? workspaceCost / recordCount : 0;

  const models = useMemo(() => buildModelBreakdown(records), [records]);
  const turnCosts = useMemo(() => chronologicalTurnCosts(records), [records]);
  const totalSpend = providers.reduce((sum, p) => sum + p.spentUsd, 0);
  const showProvider = providers.length >= 2;

  return (
    <PanelShell
      title="Overview"
      subtitle={`workspace spend across ${sessionCount} sessions`}
      maxWidthClass="max-w-5xl"
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="workspace total" value={formatUsdPrecise(workspaceCost)} />
        <StatCard label="sessions" value={String(sessionCount)} />
        <StatCard label="total tokens" value={formatTokens(totalTokens)} />
        <StatCard label="avg / turn" value={formatUsdPrecise(avgPerTurn)} />
      </div>

      {alerts.some((a) => !a.dismissedAt) ? (
        <Widget label="alerts">
          <AlertBanner alerts={alerts} onDismiss={onDismissAlert} />
        </Widget>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {providers.length > 0 ? (
          <Widget label="spend by provider" hint="share of workspace total">
            <div className="flex flex-col gap-3">
              {providers.map((entry) => {
                const id = toProviderId(entry.provider);
                return (
                  <SpendBar
                    key={entry.provider}
                    label={providerLabel(entry.provider)}
                    valueLabel={formatUsd(entry.spentUsd)}
                    pct={totalSpend > 0 ? entry.spentUsd / totalSpend : 0}
                    colorVar={id ? brandColor(id) : 'var(--color-muted-foreground)'}
                    icon={<ProviderIcon provider={entry.provider} size={14} />}
                    onClick={() => onSelect({ kind: 'provider', provider: entry.provider })}
                  />
                );
              })}
            </div>
          </Widget>
        ) : null}

        <Widget label="cost per turn">
          <Sparkline values={turnCosts} />
        </Widget>

        <Widget label="by model" className="lg:col-span-2">
          <ModelTable entries={models} showProvider={showProvider} />
        </Widget>
      </div>

      <TurnsTable turns={turns} showProvider={showProvider} showSession />
    </PanelShell>
  );
}
