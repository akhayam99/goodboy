import { useMemo } from 'react';
import { StatCard, formatTokens, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { BudgetAlert, SessionId, TelemetrySummary } from '@goodboy/types';
import type { ProviderSpendEntry } from '../../../../store';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { PanelLoading } from '../../../../shared/components/PanelLoading';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { brandColor } from '../../../providers/components/provider-brand';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { AlertBanner } from './AlertBanner';
import { ModelTable } from './ModelTable';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { SpendBar } from './SpendBar';
import { Sparkline } from './Sparkline';
import { TurnsTable } from './TurnsTable';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import {
  buildModelBreakdown,
  chronologicalTurnCosts,
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
  readonly rulesResult: QueryResult<void>;
  readonly alertsResult: QueryResult<void>;
  readonly telemetryResult: QueryResult<void>;
  readonly isLoading: boolean;
  readonly onDismissAlert: (id: string) => void;
  readonly onSelect: (scope: BudgetScope) => void;
  readonly onRetryRules: () => void;
  readonly onRetryAlerts: () => void;
  readonly onRetryTelemetry: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const OverviewPanel = ({
  workspaceSummary,
  providers,
  turns,
  sessionCount,
  alerts,
  rulesResult,
  alertsResult,
  telemetryResult,
  isLoading,
  onDismissAlert,
  onSelect,
  onRetryRules,
  onRetryAlerts,
  onRetryTelemetry,
  onOpenSession,
}: Props) => {
  const records = useMemo(() => turns.map((t) => t.record), [turns]);
  const workspaceCost = workspaceSummary?.estimatedCostUsd ?? 0;
  const totalTokens = (workspaceSummary?.inputTokens ?? 0) + (workspaceSummary?.outputTokens ?? 0);
  const recordCount = workspaceSummary?.recordCount ?? records.length;
  const avgPerTurn = recordCount > 0 ? workspaceCost / recordCount : 0;

  const models = useMemo(() => buildModelBreakdown(records), [records]);
  const turnCosts = useMemo(() => chronologicalTurnCosts(records), [records]);
  const totalSpend = providers.reduce((sum, p) => sum + p.spentUsd, 0);

  return (
    <StudioPanel
      title="Overview"
      subtitle={`workspace spend across ${sessionCount} sessions`}
      maxWidthClass="max-w-5xl"
    >
      <ErrorStrip label="budget rules" error={rulesResult.error} onRetry={onRetryRules} />
      <ErrorStrip label="budget alerts" error={alertsResult.error} onRetry={onRetryAlerts} />
      <ErrorStrip
        label="session telemetry"
        error={telemetryResult.error}
        onRetry={onRetryTelemetry}
      />
      {isLoading && <PanelLoading label="Loading budget data" />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="workspace total" value={formatUsdPrecise(workspaceCost)} />
        <StatCard label="sessions" value={String(sessionCount)} />
        <StatCard label="total tokens" value={formatTokens(totalTokens)} />
        <StatCard label="avg / turn" value={formatUsdPrecise(avgPerTurn)} />
      </div>

      {alerts.some((alert) => alert.dismissedAt == null) ? (
        <StudioWidget label="alerts">
          <AlertBanner alerts={alerts} onDismiss={onDismissAlert} />
        </StudioWidget>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {providers.length > 0 && (
          <StudioWidget label="spend by provider" hint="share of workspace total">
            <div className="flex flex-col gap-3">
              {providers.map((entry) => {
                const id = toProviderId(entry.provider);
                return (
                  <SpendBar
                    key={entry.provider}
                    label={providerLabel(entry.provider)}
                    valueLabel={formatUsd(entry.spentUsd)}
                    pct={totalSpend > 0 ? entry.spentUsd / totalSpend : 0}
                    colorVar={id !== null ? brandColor(id) : 'var(--color-muted-foreground)'}
                    icon={<ProviderIcon provider={entry.provider} size={14} />}
                    onClick={() => onSelect({ kind: 'provider', provider: entry.provider })}
                  />
                );
              })}
            </div>
          </StudioWidget>
        )}

        <StudioWidget label="cost per turn">
          <Sparkline values={turnCosts} />
        </StudioWidget>

        <StudioWidget label="by model" className="lg:col-span-2">
          <ModelTable entries={models} />
        </StudioWidget>
      </div>

      <TurnsTable turns={turns} showSession onOpenSession={onOpenSession} />
    </StudioPanel>
  );
};
