import {
  PROVIDER_ID_TO_NAME,
  type HiddenModels,
  providersByHeadroom,
  workingProviders,
  type HeadroomMap,
  type WorkflowRoutingAvailabilitySnapshot,
} from '@goodboy/core';
import {
  PROVIDER_IDS,
  type BudgetAlert,
  type ProviderId,
  type ProviderPolicy,
  type SessionId,
} from '@goodboy/types';
import { autoRoutableProviders } from '../providers/autoRoutableProviders';
import type { ProviderDisplayInfo } from '../providers/providers';
import { providersCoolingDown } from '../providers/taskModelRouting';
import type { ProviderCooldowns } from '../providers/routing';

type Params = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
  readonly cooldowns: ProviderCooldowns;
  readonly alerts: ReadonlyArray<BudgetAlert>;
  readonly hidden: HiddenModels | null;
  readonly sessionId: SessionId | null;
  readonly isRunBudgetBlocked: boolean;
  readonly nowMs: number;
  readonly providerPool?: ReadonlyArray<ProviderId> | null;
  readonly policy?: ProviderPolicy | null;
  readonly atLimit?: ReadonlyArray<ProviderId>;
  readonly headroom?: HeadroomMap | null;
};

const liveAlerts = (alerts: ReadonlyArray<BudgetAlert>): ReadonlyArray<BudgetAlert> =>
  alerts.filter((alert) => alert.dismissedAt === undefined);

export const workflowAvailabilitySnapshot = ({
  providers,
  cooldowns,
  alerts,
  hidden,
  sessionId,
  isRunBudgetBlocked,
  nowMs,
  providerPool = null,
  policy = null,
  atLimit = [],
  headroom = null,
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
  const connected = autoRoutableProviders({ providers }).filter(
    (provider) => providerPool === null || providerPool.includes(provider),
  );
  const working = workingProviders({
    defaultProvider: connected[0] ?? 'anthropic',
    connected,
    atLimit,
    policy,
    headroom,
  });
  const usable = working ?? connected;
  const ordered = headroom === null ? usable : providersByHeadroom({ providers: usable, headroom });
  return {
    connectedProviders: ordered,
    ...((working !== null || headroom !== null) && { providerOrder: ordered }),
    coolingDownProviders: providersCoolingDown({ cooldowns, nowMs }),
    budgetBlockedProviders,
    isSessionBudgetBlocked:
      sessionId === null
        ? false
        : live.some((alert) => alert.kind === 'session-exceeded' && alert.sessionId === sessionId),
    isRunBudgetBlocked,
    nowMs,
    ...(hidden !== null && { hiddenModels: hidden }),
  };
};
