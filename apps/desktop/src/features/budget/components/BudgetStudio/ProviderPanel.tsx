import { useMemo } from 'react';
import { StatCard, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { BudgetRule, ProviderName, SessionId } from '@goodboy/types';
import type { ProviderSpendEntry } from '../../../../store';
import { ErrorStrip } from '../../../../shared/components/ErrorStrip';
import { PanelLoading } from '../../../../shared/components/PanelLoading';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { CapEditor } from './CapEditor';
import { CostRing } from './CostRing';
import { ModelTable } from './ModelTable';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { TurnsTable } from './TurnsTable';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import { buildModelBreakdown, providerLabel, type WorkspaceTurn } from './lib';

type Props = {
  readonly provider: ProviderName;
  readonly entry: ProviderSpendEntry | null;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly rule: BudgetRule | null;
  readonly rulesResult: QueryResult<void>;
  readonly telemetryResult: QueryResult<void>;
  readonly isLoading: boolean;
  readonly onSaveCap: (capUsd: number) => Promise<void>;
  readonly onRemoveCap: () => Promise<void>;
  readonly onRetryRules: () => void;
  readonly onRetryTelemetry: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const ProviderPanel = ({
  provider,
  entry,
  turns,
  rule,
  rulesResult,
  telemetryResult,
  isLoading,
  onSaveCap,
  onRemoveCap,
  onRetryRules,
  onRetryTelemetry,
  onOpenSession,
}: Props) => {
  const spent = entry?.spentUsd ?? 0;
  const capUsd = entry?.capUsd ?? null;
  const pct = entry?.pct ?? 0;
  const remaining = capUsd !== null ? Math.max(capUsd - spent, 0) : null;

  const filtered = useMemo(
    () => turns.filter((t) => t.record.provider === provider),
    [turns, provider],
  );
  const models = useMemo(() => buildModelBreakdown(filtered.map((t) => t.record)), [filtered]);

  return (
    <StudioPanel
      icon={<ProviderIcon provider={provider} size={20} />}
      title={providerLabel(provider)}
      subtitle={`${formatUsd(spent)} total spend`}
    >
      <ErrorStrip label="budget rules" error={rulesResult.error} onRetry={onRetryRules} />
      <ErrorStrip
        label="session telemetry"
        error={telemetryResult.error}
        onRetry={onRetryTelemetry}
      />
      {isLoading && <PanelLoading label="Loading budget data" />}
      {capUsd !== null ? (
        <section className="flex items-center gap-6 rounded-lg border border-border-soft bg-muted/20 p-5">
          <CostRing pct={pct} centerLabel={`${Math.round(pct * 100)}%`} subLabel="of cap" />
          <div className="grid flex-1 grid-cols-3 gap-3">
            <div title={formatUsdPrecise(spent)}>
              <StatCard label="spent" value={formatUsd(spent)} />
            </div>
            <StatCard label="cap" value={formatUsd(capUsd)} />
            <StatCard label="remaining" value={formatUsd(remaining ?? 0)} />
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-3 gap-3">
          <div title={formatUsdPrecise(spent)}>
            <StatCard label="spent" value={formatUsd(spent)} />
          </div>
          <StatCard label="turns" value={String(filtered.length)} />
          <StatCard label="models" value={String(models.length)} />
        </section>
      )}

      <CapEditor
        label="monthly cap"
        hint="cap monthly spend for this provider"
        currentCapUsd={rule?.capUsd ?? null}
        onSave={onSaveCap}
        onRemove={onRemoveCap}
      />

      <StudioWidget label="by model">
        <ModelTable entries={models} />
      </StudioWidget>

      <TurnsTable turns={filtered} showSession onOpenSession={onOpenSession} />
    </StudioPanel>
  );
};
