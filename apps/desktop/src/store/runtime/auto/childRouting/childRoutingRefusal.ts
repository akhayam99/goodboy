import {
  isAutoChildProvider,
  isAutoOwnProvider,
  type AutoDelegationRole,
} from '@goodboy/core/auto';
import type {
  OrchestratorModelOption,
  WorkflowRoutingAvailabilitySnapshot,
} from '@goodboy/core/orchestrator';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../../features/providers/providerLabel';
import type { ProviderCooldowns } from '../../../../features/providers/routing';
import { formatClock } from '../../../../shared/utils/time/formatClock';

type Params = Readonly<{
  role: AutoDelegationRole;
  connected: ReadonlyArray<ProviderId>;
  pool: ReadonlyArray<ProviderId>;
  availability: WorkflowRoutingAvailabilitySnapshot;
  menu: ReadonlyArray<OrchestratorModelOption>;
  cooldowns: ProviderCooldowns;
  nowMs: number;
}>;

const FIX = 'Change providers or visible models in Settings › Models.';

type ProviderBlockParams = Omit<Params, 'connected'> & Readonly<{ provider: ProviderId }>;

const providerBlockOf = ({
  provider,
  role,
  pool,
  availability,
  menu,
  cooldowns,
  nowMs,
}: ProviderBlockParams): string => {
  if (!isAutoChildProvider({ provider, role })) {
    return 'runs only reading roles for Auto, never one that writes code';
  }
  if (!pool.includes(provider)) {
    return 'turned off for this workspace';
  }
  const until = cooldowns[provider];
  if (until !== undefined && until > nowMs) {
    return `usage limit until ${formatClock({ at: until })}`;
  }
  if (availability.budgetBlockedProviders.includes(provider)) {
    return 'budget reached';
  }
  if (!menu.some((option) => option.provider === provider)) {
    return 'no visible model';
  }
  return `no model set for the ${role} role`;
};

export const childRoutingRefusal = ({ connected, ...rest }: Params): string => {
  if (rest.availability.isSessionBudgetBlocked) {
    return 'This conversation reached its spending limit. Raise it to start more agents.';
  }
  const candidates = connected.filter((provider) => isAutoOwnProvider({ provider }));
  if (candidates.length === 0) {
    return `No provider the Lead can use is connected. ${FIX}`;
  }
  const lines = candidates.map(
    (provider) => `${PROVIDER_LABEL[provider]}: ${providerBlockOf({ ...rest, provider })}.`,
  );
  return `No model can take the ${rest.role} role. ${lines.join(' ')} ${FIX}`;
};
