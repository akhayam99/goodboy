import { ErrorStrip, PanelLoading, SectionHeader, StudioWidget, formatUsd } from '@goodboy/ui';
import type { BudgetAlert, ProviderName } from '@goodboy/types';
import type { ProviderSpendEntry } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { AlertBanner } from './AlertBanner';
import { SpendBar } from './SpendBar';
import { providerLabel } from './lib';

type Props = {
  readonly providers: ReadonlyArray<ProviderSpendEntry>;
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly rulesResult: QueryResult<void>;
  readonly alertsResult: QueryResult<void>;
  readonly telemetryResult: QueryResult<void>;
  readonly isLoading: boolean;
  readonly onDismissAlert: (id: string) => void;
  readonly onSelectProvider: (provider: ProviderName) => void;
  readonly onRetryRules: () => void;
  readonly onRetryAlerts: () => void;
  readonly onRetryTelemetry: () => void;
};

type CapLabelParams = {
  readonly entry: ProviderSpendEntry;
};

const capLabel = ({ entry }: CapLabelParams): string =>
  entry.capUsd === null
    ? 'no cap'
    : `${formatUsd(entry.capUsd)} cap · ${Math.round(entry.pct * 100)}% used`;

export const SpendSection = ({
  providers,
  alerts,
  rulesResult,
  alertsResult,
  telemetryResult,
  isLoading,
  onDismissAlert,
  onSelectProvider,
  onRetryRules,
  onRetryAlerts,
  onRetryTelemetry,
}: Props) => {
  const totalSpend = providers.reduce((sum, entry) => sum + entry.spentUsd, 0);
  const hasAlerts = alerts.some((alert) => alert.dismissedAt == null);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Spend"
        icon={<CONCEPT_ICONS.budget size={ICON_SIZE.control} aria-hidden />}
        hint="Provider spend and caps for this window. Pick a provider to edit its cap."
        headingLevel={2}
      />
      <ErrorStrip label="budget rules" error={rulesResult.error} onRetry={onRetryRules} />
      <ErrorStrip label="budget alerts" error={alertsResult.error} onRetry={onRetryAlerts} />
      <ErrorStrip
        label="session telemetry"
        error={telemetryResult.error}
        onRetry={onRetryTelemetry}
      />
      {isLoading && providers.length === 0 ? <PanelLoading label="Loading budget data" /> : null}
      {hasAlerts ? (
        <StudioWidget label="alerts">
          <AlertBanner alerts={alerts} onDismiss={onDismissAlert} />
        </StudioWidget>
      ) : null}
      {providers.length > 0 ? (
        <StudioWidget label="by provider" hint="share of workspace total">
          <div className="flex flex-col gap-3">
            {providers.map((entry) => (
              <SpendBar
                key={entry.provider}
                label={providerLabel(entry.provider)}
                valueLabel={formatUsd(entry.spentUsd)}
                metaLabel={capLabel({ entry })}
                pct={totalSpend > 0 ? entry.spentUsd / totalSpend : 0}
                icon={<ProviderIcon provider={entry.provider} size={ICON_SIZE.control} />}
                onClick={() => onSelectProvider(entry.provider)}
              />
            ))}
          </div>
        </StudioWidget>
      ) : null}
    </section>
  );
};
