import { useMemo } from 'react';
import { SegmentedTabs } from '@goodboy/ui';
import type { ProviderName } from '@goodboy/types';
import { ProviderPanel } from '../../../../../../features/budget/components/spend/ProviderPanel';
import { useWorkspaceSpend } from '../../../../../../features/budget/hooks/useWorkspaceSpend';
import { spendFigures } from '../../../../../../features/budget/spendFigures';
import { ImpactTabs } from '../../../../../../features/impact/components/ImpactStudio/ImpactTabs';
import { OverviewPanel } from '../../../../../../features/impact/components/ImpactStudio/OverviewPanel';
import { impactMeta } from '../../../../../../features/impact/impactMeta';
import { IMPACT_WINDOW_OPTIONS, impactWindowStart } from '../../../../../../features/impact/lib';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../../../shared/components/StudioShell';
import type { PaneFrame } from '../../../../../../shared/types/paneFrame';
import { OVERVIEW, PULL_REQUESTS, REVIEWS } from '../../features/ImpactOverviewScene';
import type { ImpactSceneMode } from './impactSceneMode';

type Props = {
  readonly mode: ImpactSceneMode;
};

const PROVIDER: ProviderName = 'anthropic';
const SESSIONS_DONE = 14;
const RANGE_LABEL = '30 days';

const noop = (): void => undefined;
const noopAsync = async (): Promise<void> => undefined;

const overviewOf = ({ mode }: Props) =>
  mode === 'empty'
    ? { ...OVERVIEW, sessionCount: 0, sessions: [], spendUsd: 0 }
    : { ...OVERVIEW, sessionCount: SESSIONS_DONE };

export const ImpactSceneBody = ({ mode }: Props) => {
  const sinceMs = useMemo(() => impactWindowStart({ windowId: 'last30', nowMs: Date.now() }), []);
  const spend = useWorkspaceSpend({ sinceMs });
  const overview = overviewOf({ mode });
  const rangeSpend = spendFigures({
    records: spend.turns.map((turn) => turn.record),
    nowMs: Date.now(),
    sinceMs,
  }).range;
  const frame: PaneFrame = {
    title: 'Impact',
    meta: impactMeta({
      rangeLabel: RANGE_LABEL,
      sessionCount: overview.sessionCount,
      spentUsd: rangeSpend.usd,
    }),
    actions: (
      <SegmentedTabs
        ariaLabel="Impact window"
        options={IMPACT_WINDOW_OPTIONS}
        value="last30"
        onChange={noop}
        size="xs"
      />
    ),
    tabs: <ImpactTabs value={mode === 'spend' ? 'spend' : 'overview'} onChange={noop} />,
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.impact}
      tone={CONCEPT_TONE.impact}
      title="Impact"
      closeLabel="Close impact"
      onClose={noop}
    >
      {() => (
        <div className="flex min-h-0 min-w-0 flex-1">
          {mode === 'spend' ? (
            <ProviderPanel
              frame={frame}
              rangeLabel={RANGE_LABEL}
              onBack={noop}
              provider={PROVIDER}
              entry={spend.providers.find((entry) => entry.provider === PROVIDER) ?? null}
              turns={spend.turns}
              rule={spend.rules.find((rule) => rule.provider === PROVIDER) ?? null}
              rulesResult={spend.data.rules}
              telemetryResult={spend.data.telemetry}
              isLoading={false}
              onSaveLimit={noopAsync}
              onRemoveLimit={noopAsync}
              onRetryRules={noop}
              onRetryTelemetry={noop}
              onOpenSession={noop}
            />
          ) : (
            <OverviewPanel
              frame={frame}
              overview={{ data: overview, error: null }}
              pullRequests={{ data: PULL_REQUESTS, error: null }}
              reviews={{ data: REVIEWS, error: null }}
              isLoading={false}
              onRetryOverview={noop}
              onRetryShipped={noop}
              onSelectTab={noop}
              onOpenSession={noop}
              onStartSession={noop}
            />
          )}
        </div>
      )}
    </StudioShell>
  );
};
