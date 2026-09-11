import { PROVIDER_ID_TO_NAME, type WorkflowRoutingAvailabilitySnapshot } from '@goodboy/core';
import { PROVIDER_IDS, type BudgetAlert, type ProviderId, type SessionId } from '@goodboy/types';
import type { ProviderInfo } from '../providers/providers';
import { providersCoolingDown } from '../providers/taskModelRouting';
import type { ProviderCooldowns } from '../providers/routing';

type Params = {
  readonly providers: ReadonlyArray<ProviderInfo>;
  readonly cooldowns: ProviderCooldowns;
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly sessionId: SessionId;
  readonly isRunBudgetBlocked: boolean;
  readonly nowMs: number;
};

const liveAlerts = (alerts: ReadonlyArray<BudgetAlert>): ReadonlyArray<BudgetAlert> =>
  alerts.filter((alert) => alert.dismissedAt === undefined);

export const workflowAvailabilitySnapshot = ({
  providers,
  cooldowns,
  alerts,
  sessionId,
  isRunBudgetBlocked,
  nowMs,
}: Params): WorkflowRoutingAvailabilitySnapshot => {
  const live = liveAlerts(alerts);
  const blockedNames = new Set(
    live.flatMap((alert) =>
      alert.kind === 'provider-exceeded' && alert.provider !== undefined ? [alert.provider] : [],
    ),
  );
  const budgetBlockedProviders: ReadonlyArray<ProviderId> = PROVIDER_IDS.filter((provider) =>
    blockedNames.has(PROVIDER_ID_TO_NAME[provider]),
  );
  return {
    connectedProviders: providers
      .filter((provider) => provider.connection === 'connected')
      .map((provider) => provider.id),
    coolingDownProviders: providersCoolingDown({ cooldowns, nowMs }),
    budgetBlockedProviders,
    isSessionBudgetBlocked: live.some(
      (alert) => alert.kind === 'session-exceeded' && alert.sessionId === sessionId,
    ),
    isRunBudgetBlocked,
    nowMs,
  };
};
