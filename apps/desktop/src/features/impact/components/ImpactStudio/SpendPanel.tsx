import { useMemo } from 'react';
import type { ProviderName, SessionId } from '@goodboy/types';
import { SectionHeader, formatUsd, formatUsdPrecise, PaneShell } from '@goodboy/ui';
import { SpendSection } from '../../../budget/components/spend/SpendSection';
import type { WorkspaceSpend } from '../../../budget/hooks/useWorkspaceSpend';
import type { ImpactMetrics } from '../../hooks/useImpactMetrics';
import { IMPACT_WINDOW_OPTIONS, type ImpactWindowId } from '../../lib';
import { spendTotals } from '../../utils/spendTotals';
import { EfficiencySection } from './EfficiencySection';
import { SessionSpendRows } from './SessionSpendRows';
import type { PaneFrame } from '../../../../shared/types/paneFrame';

type Props = {
  readonly frame: PaneFrame;
  readonly windowId: ImpactWindowId;
  readonly spend: WorkspaceSpend;
  readonly metrics: ImpactMetrics;
  readonly onSelectProvider: (provider: ProviderName) => void;
  readonly onSelectSession: (sessionId: SessionId) => void;
};

export const SpendPanel = ({
  frame,
  windowId,
  spend,
  metrics,
  onSelectProvider,
  onSelectSession,
}: Props) => {
  const totals = useMemo(
    () => spendTotals({ turns: spend.turns, nowMs: Date.now() }),
    [spend.turns],
  );
  const windowLabel =
    IMPACT_WINDOW_OPTIONS.find((option) => option.value === windowId)?.label ?? '';
  return (
    <PaneShell scroll="body" {...frame}>
      <div className="flex items-baseline gap-8">
        <div className="flex flex-col" title={formatUsdPrecise(totals.windowUsd)}>
          <span className="text-label text-muted-foreground">{windowLabel}</span>
          <span className="text-display tabular-nums text-foreground">
            {formatUsd(totals.windowUsd)}
          </span>
        </div>
        <div className="flex flex-col" title={formatUsdPrecise(totals.todayUsd)}>
          <span className="text-label text-muted-foreground">Today</span>
          <span className="text-title tabular-nums text-foreground">
            {formatUsd(totals.todayUsd)}
          </span>
        </div>
      </div>
      <SpendSection
        providers={spend.providers}
        alerts={spend.alerts}
        rulesResult={spend.data.rules}
        alertsResult={spend.data.alerts}
        telemetryResult={spend.data.telemetry}
        isLoading={
          spend.data.loading.rules || spend.data.loading.alerts || spend.data.loading.telemetry
        }
        onDismissAlert={spend.dismissAlert}
        onSelectProvider={onSelectProvider}
        onRetryRules={() => spend.data.retry('rules')}
        onRetryAlerts={() => spend.data.retry('alerts')}
        onRetryTelemetry={() => spend.data.retry('telemetry')}
      />
      {spend.sessions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeader
            label="Sessions by spend"
            hint="Pick a session to see its turns and set its limit."
            headingLevel={2}
          />
          <SessionSpendRows sessions={spend.sessions} onSelectSession={onSelectSession} />
        </section>
      ) : null}
      <EfficiencySection
        cacheEfficiency={metrics.cacheEfficiency}
        contextGrowth={metrics.contextGrowth}
        turns={metrics.turns}
        nudges={metrics.nudges}
        isLoading={metrics.loading.efficiency}
        onRetry={() => metrics.retry('efficiency')}
      />
    </PaneShell>
  );
};
