import { ErrorStrip, PanelLoading, SectionHeader, StudioWidget, formatUsd } from '@goodboy/ui';
import type { BudgetAlert, ProviderName } from '@goodboy/types';
import type { ProviderBudgetEntry } from '../../hooks/useWorkspaceSpend';
import { budgetPctUsed } from '../../providerBudgetView';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { AlertBanner } from './AlertBanner';
import { SpendBar } from './SpendBar';
import { providerLabel } from '../../providerLabel';

type Props = {
  readonly providers: ReadonlyArray<ProviderBudgetEntry>;
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

type LimitLabelParams = {
  readonly entry: ProviderBudgetEntry;
};

const limitLabel = ({ entry }: LimitLabelParams): string => {
  const { budget } = entry;
  if (budget === null || budget.capUsd === null) {
    return 'No limit';
  }
  return `${formatUsd(budget.capUsd)} limit · ${budgetPctUsed({ status: budget })}% used this month`;
};

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
  const hasAlerts = alerts.some((alert) => alert.dismissedAt === undefined);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        label="Spend"
        icon={<CONCEPT_ICONS.budget size={ICON_SIZE.control} aria-hidden />}
        hint="Limits count the whole month, across workspaces."
        headingLevel={2}
      />
      <ErrorStrip label="limits" error={rulesResult.error} onRetry={onRetryRules} />
      <ErrorStrip label="budget alerts" error={alertsResult.error} onRetry={onRetryAlerts} />
      <ErrorStrip
        label="session telemetry"
        error={telemetryResult.error}
        onRetry={onRetryTelemetry}
      />
      {isLoading && providers.length === 0 ? <PanelLoading label="Loading budget data" /> : null}
      {hasAlerts ? (
        <StudioWidget label="Alerts">
          <AlertBanner alerts={alerts} onDismiss={onDismissAlert} />
        </StudioWidget>
      ) : null}
      {providers.length > 0 ? (
        <StudioWidget label="By provider" hint="Share of the workspace total.">
          <div className="flex flex-col gap-3">
            {providers.map((entry) => (
              <SpendBar
                key={entry.provider}
                label={providerLabel({ provider: entry.provider })}
                valueLabel={formatUsd(entry.spentUsd)}
                metaLabel={limitLabel({ entry })}
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
