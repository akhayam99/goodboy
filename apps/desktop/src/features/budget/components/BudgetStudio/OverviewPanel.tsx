import { useMemo } from 'react';
import { EmptyState, StatCard, formatTokens, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { BudgetAlert, SessionId } from '@goodboy/types';
import type { ProviderSpendEntry } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { PanelLoading } from '../../../../shared/components/PanelLoading';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { AlertBanner } from './AlertBanner';
import { ModelTable } from './ModelTable';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { SpendBar } from './SpendBar';
import { TurnsTable } from './TurnsTable';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import { Sparkline } from '../../../../shared/components/Sparkline';
import {
  buildModelBreakdown,
  chronologicalTurnCosts,
  providerLabel,
  type BudgetScope,
  type WorkspaceTurn,
} from './lib';

type Props = {
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
  const workspaceCost = records.reduce((sum, record) => sum + record.estimatedCostUsd, 0);
  const totalTokens = records.reduce(
    (sum, record) => sum + record.inputTokens + record.outputTokens,
    0,
  );
  const recordCount = records.length;
  const avgPerTurn = recordCount > 0 ? workspaceCost / recordCount : 0;

  const models = useMemo(() => buildModelBreakdown(records), [records]);
  const turnCosts = useMemo(() => chronologicalTurnCosts(records), [records]);
  const totalSpend = providers.reduce((sum, p) => sum + p.spentUsd, 0);
  const isEmpty = sessionCount === 0 && providers.length === 0 && recordCount === 0;

  return (
    <StudioPanel title="Overview" subtitle={`Workspace spend across ${sessionCount} sessions`}>
      <ErrorStrip label="budget rules" error={rulesResult.error} onRetry={onRetryRules} />
      <ErrorStrip label="budget alerts" error={alertsResult.error} onRetry={onRetryAlerts} />
      <ErrorStrip
        label="session telemetry"
        error={telemetryResult.error}
        onRetry={onRetryTelemetry}
      />
      {isLoading && <PanelLoading label="Loading budget data" />}
      {isEmpty ? (
        <EmptyState
          icon={CONCEPT_ICONS.budget}
          tone={CONCEPT_TONE.budget}
          title="No spend recorded yet"
          description="Run sessions to see workspace spend, provider mix, and cost per turn."
          bordered
          size="lg"
          headingLevel={2}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div title={formatUsdPrecise(workspaceCost)}>
              <StatCard label="workspace total" value={formatUsd(workspaceCost)} />
            </div>
            <StatCard label="sessions" value={String(sessionCount)} />
            <StatCard label="total tokens" value={formatTokens(totalTokens)} />
            <div title={formatUsdPrecise(avgPerTurn)}>
              <StatCard label="avg / turn" value={formatUsd(avgPerTurn)} />
            </div>
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
                    return (
                      <SpendBar
                        key={entry.provider}
                        label={providerLabel(entry.provider)}
                        valueLabel={formatUsd(entry.spentUsd)}
                        pct={totalSpend > 0 ? entry.spentUsd / totalSpend : 0}
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
        </>
      )}
    </StudioPanel>
  );
};
