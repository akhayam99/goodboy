import { useMemo, type ReactElement } from 'react';
import { StatCard, formatUsd, formatUsdPrecise, PaneShell } from '@goodboy/ui';
import type { BudgetRule, ProviderName, SessionId } from '@goodboy/types';
import { ErrorStrip } from '@goodboy/ui';
import { PanelLoading } from '@goodboy/ui';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { CapEditor } from './CapEditor';
import { CostRing } from './CostRing';
import { CoverageNotice } from './CoverageNotice';
import { ModelTable } from './ModelTable';
import { SpendAnchorTitle } from './SpendAnchorTitle';
import { TurnsTable } from './TurnsTable';
import { StudioWidget } from '@goodboy/ui';
import { buildModelBreakdown, coverageTurnCounts, providerLabel, type WorkspaceTurn } from './lib';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ProviderBudgetEntry } from '../../hooks/useWorkspaceSpend';
import {
  budgetPctUsed,
  budgetRingFraction,
  budgetScopeNote,
  budgetWarnFraction,
} from '../../providerBudgetView';

type Props = {
  readonly header: ReactElement;
  readonly onBack: () => void;
  readonly provider: ProviderName;
  readonly entry: ProviderBudgetEntry | null;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly rule: BudgetRule | null;
  readonly rulesResult: QueryResult<void>;
  readonly telemetryResult: QueryResult<void>;
  readonly isLoading: boolean;
  readonly onSaveCap: (capUsd: number) => Promise<void>;
  readonly onSaveThreshold: (thresholdPct: number) => Promise<void>;
  readonly onRemoveCap: () => Promise<void>;
  readonly onRetryRules: () => void;
  readonly onRetryTelemetry: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const ProviderPanel = ({
  header,
  onBack,
  provider,
  entry,
  turns,
  rule,
  rulesResult,
  telemetryResult,
  isLoading,
  onSaveCap,
  onSaveThreshold,
  onRemoveCap,
  onRetryRules,
  onRetryTelemetry,
  onOpenSession,
}: Props) => {
  const spent = entry?.spentUsd ?? 0;
  const budget = entry?.budget ?? null;
  const capUsd = budget?.capUsd ?? null;

  const filtered = useMemo(
    () => turns.filter((t) => t.record.provider === provider),
    [turns, provider],
  );
  const models = useMemo(() => buildModelBreakdown(filtered.map((t) => t.record)), [filtered]);
  const coverage = useMemo(() => coverageTurnCounts(models), [models]);

  return (
    <PaneShell scroll="body" header={header}>
      <SpendAnchorTitle
        glyph={<ProviderIcon provider={provider} size={ICON_SIZE.hero} />}
        title={providerLabel({ provider })}
        meta={`${formatUsd(spent)} total spend`}
        onBack={onBack}
      />
      <ErrorStrip label="spend caps" error={rulesResult.error} onRetry={onRetryRules} />
      <ErrorStrip
        label="session telemetry"
        error={telemetryResult.error}
        onRetry={onRetryTelemetry}
      />
      {isLoading && <PanelLoading label="Loading budget data" />}
      {budget !== null && capUsd !== null ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle p-5">
          <div className="flex items-center gap-6">
            <CostRing
              pct={budgetRingFraction({ status: budget })}
              centerLabel={`${budgetPctUsed({ status: budget })}%`}
              subLabel="of cap"
              warnAt={budgetWarnFraction({ status: budget })}
            />
            <div className="grid flex-1 grid-cols-3 gap-3">
              <div title={formatUsdPrecise(budget.spentUsd)}>
                <StatCard label="spent this month" value={formatUsd(budget.spentUsd)} />
              </div>
              <StatCard label="cap" value={formatUsd(capUsd)} />
              <StatCard
                label="remaining"
                value={formatUsd(Math.max(capUsd - budget.spentUsd, 0))}
              />
            </div>
          </div>
          <p className="text-meta text-muted-foreground">{budgetScopeNote({ status: budget })}</p>
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

      <CoverageNotice counts={coverage} />

      <CapEditor
        label="monthly cap"
        hint="Cap the monthly spend for this provider"
        currentCapUsd={rule?.capUsd ?? null}
        {...(rule !== null
          ? { threshold: { pct: rule.alertThresholdPct, onSave: onSaveThreshold } }
          : {})}
        onSave={onSaveCap}
        onRemove={onRemoveCap}
      />

      <StudioWidget label="by model">
        <ModelTable entries={models} />
      </StudioWidget>

      <TurnsTable turns={filtered} showSession onOpenSession={onOpenSession} />
    </PaneShell>
  );
};
