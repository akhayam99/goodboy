import { useMemo } from 'react';
import {
  ErrorStrip,
  PanelLoading,
  PaneShell,
  StatCard,
  StudioWidget,
  Tooltip,
  formatUsd,
  formatUsdPrecise,
} from '@goodboy/ui';
import type { BudgetRule, ProviderName, SessionId } from '@goodboy/types';
import type { QueryResult } from '../../../../shared/types/queryResult';
import type { PaneFrame } from '../../../../shared/types/paneFrame';
import { formatDayMonth } from '../../../../shared/utils/time/formatDayMonth';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import type { ProviderBudgetEntry } from '../../hooks/useWorkspaceSpend';
import { spendFigures } from '../../spendFigures';
import { CapEditor, type SaveLimitParams } from './CapEditor';
import { CostGuideLink } from './CostGuideLink';
import { CostRing } from './CostRing';
import { CoverageNotice } from './CoverageNotice';
import { ModelTable } from './ModelTable';
import { SpendAnchorTitle } from './SpendAnchorTitle';
import { TurnsTable } from './TurnsTable';
import { providerLabel } from '../../providerLabel';
import { buildModelBreakdown, coverageTurnCounts, type WorkspaceTurn } from './lib';

const RING_SIZE = 96;

type Props = {
  readonly frame: PaneFrame;
  readonly rangeLabel: string;
  readonly provider: ProviderName;
  readonly entry: ProviderBudgetEntry | null;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly rule: BudgetRule | null;
  readonly rulesResult: QueryResult<void>;
  readonly telemetryResult: QueryResult<void>;
  readonly isLoading: boolean;
  readonly onSaveLimit: (params: SaveLimitParams) => Promise<void>;
  readonly onRemoveLimit: () => Promise<void>;
  readonly onRetryRules: () => void;
  readonly onRetryTelemetry: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const ProviderPanel = ({
  frame,
  rangeLabel,
  provider,
  entry,
  turns,
  rule,
  rulesResult,
  telemetryResult,
  isLoading,
  onSaveLimit,
  onRemoveLimit,
  onRetryRules,
  onRetryTelemetry,
  onOpenSession,
}: Props) => {
  const budget = entry?.budget ?? null;
  const name = providerLabel({ provider });

  const filtered = useMemo(
    () => turns.filter((t) => t.record.provider === provider),
    [turns, provider],
  );
  const models = useMemo(() => buildModelBreakdown(filtered.map((t) => t.record)), [filtered]);
  const coverage = useMemo(() => coverageTurnCounts(models), [models]);
  const figures = useMemo(
    () =>
      spendFigures({
        records: filtered.map((turn) => turn.record),
        nowMs: Date.now(),
        sinceMs: null,
        budget,
      }),
    [budget, filtered],
  );
  const rangeText = rangeLabel.toLowerCase();

  return (
    <PaneShell scroll="body" {...frame}>
      <SpendAnchorTitle
        glyph={<ProviderIcon provider={provider} size={ICON_SIZE.hero} />}
        title={name}
        meta={`${formatUsd(figures.range.usd)} spent, ${rangeText}`}
      />
      <ErrorStrip label="limits" error={rulesResult.error} onRetry={onRetryRules} />
      <ErrorStrip
        label="session telemetry"
        error={telemetryResult.error}
        onRetry={onRetryTelemetry}
      />
      {isLoading && <PanelLoading label="Loading budget data" />}
      {figures.limit !== null && figures.month !== null ? (
        <StudioWidget
          label={`${name} this month`}
          hint="Counted across all workspaces."
          presentation="section"
          action={
            <span className="text-meta text-faint-foreground">
              {`Resets ${formatDayMonth({ at: figures.limit.resetsAtMs })}`}
            </span>
          }
        >
          <div className="flex items-center gap-4">
            <CostRing
              pct={figures.limit.ringFraction}
              centerLabel={`${figures.limit.pctUsed}%`}
              subLabel="of the limit"
              size={RING_SIZE}
              {...(figures.limit.warnFraction !== undefined && {
                warnAt: figures.limit.warnFraction,
              })}
            />
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">
              <Tooltip content={formatUsdPrecise(figures.month.usd)}>
                <div>
                  <StatCard
                    label="Spent this month"
                    value={formatUsd(figures.month.usd)}
                    valueSize="lg"
                  />
                </div>
              </Tooltip>
              <StatCard label="Limit" value={formatUsd(figures.limit.limitUsd)} valueSize="lg" />
              <StatCard label="Left" value={formatUsd(figures.limit.leftUsd)} valueSize="lg" />
            </div>
          </div>
        </StudioWidget>
      ) : (
        <StudioWidget label={`${name}, ${rangeText}`} presentation="section">
          <div className="grid grid-cols-3 gap-3">
            <Tooltip content={formatUsdPrecise(figures.range.usd)}>
              <div>
                <StatCard label="Spent" value={formatUsd(figures.range.usd)} valueSize="lg" />
              </div>
            </Tooltip>
            <StatCard label="Turns" value={String(filtered.length)} valueSize="lg" />
            <StatCard label="Models" value={String(models.length)} valueSize="lg" />
          </div>
        </StudioWidget>
      )}

      <CoverageNotice counts={coverage} />

      <CapEditor
        key={provider}
        label="Monthly limit"
        hint="At the share you pick, Goodboy warns you and tries another provider."
        currentCapUsd={rule?.capUsd ?? null}
        currentThresholdPct={rule?.alertThresholdPct ?? null}
        onSave={onSaveLimit}
        onRemove={onRemoveLimit}
      />

      <StudioWidget label="By model" presentation="section">
        <ModelTable entries={models} />
      </StudioWidget>

      <TurnsTable turns={filtered} showSession onOpenSession={onOpenSession} />
      <CostGuideLink />
    </PaneShell>
  );
};
