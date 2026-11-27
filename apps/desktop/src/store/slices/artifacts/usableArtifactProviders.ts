import type { ProviderId, SessionId } from '@goodboy/types';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { workspacePolicyAvailability } from '../providerLimits/workspacePolicyAvailability';
import { selectBlockedModels } from '../providers/selectBlockedModels';
import type { GetFn } from './types';

type Params = {
  readonly state: ReturnType<GetFn>;
  readonly sessionId: SessionId;
};

export const usableArtifactProviders = ({
  state,
  sessionId,
}: Params): ReadonlyArray<ProviderId> | null => {
  const availability = workflowAvailabilitySnapshot({
    providers: state.providers ?? [],
    cooldowns: state.providerCooldowns ?? {},
    alerts: state.budgetAlerts ?? [],
    hidden: selectBlockedModels({ state }),
    sessionId,
    isRunBudgetBlocked: false,
    nowMs: Date.now(),
    ...workspacePolicyAvailability({ state, sessionId }),
  });
  const usable = availability.connectedProviders.filter(
    (provider) =>
      !availability.coolingDownProviders.includes(provider) &&
      !availability.budgetBlockedProviders.includes(provider),
  );
  return usable.length > 0 ? usable : null;
};
