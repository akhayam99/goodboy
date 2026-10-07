import type { ProviderId, WorkflowModelPick } from '@goodboy/types';
import { catalogModelForId } from '../providers/catalogModelForId';
import { isModelHidden, type HiddenModels } from '../providers/modelVisibility';

export type WorkflowRoutingAvailabilitySnapshot = Readonly<{
  connectedProviders: ReadonlyArray<ProviderId>;
  coolingDownProviders: ReadonlyArray<ProviderId>;
  budgetBlockedProviders: ReadonlyArray<ProviderId>;
  isSessionBudgetBlocked: boolean;
  isRunBudgetBlocked: boolean;
  nowMs: number;
  providerOrder?: ReadonlyArray<ProviderId>;
  hiddenModels?: HiddenModels | null;
}>;

export type WorkflowRoutingUnavailableCause =
  'unknown_model' | 'disconnected' | 'cooldown' | 'budget' | 'hidden';

export type WorkflowRoutingAvailability =
  | Readonly<{ kind: 'available' }>
  | Readonly<{ kind: 'unavailable'; cause: WorkflowRoutingUnavailableCause }>;

type Params = {
  readonly pick: WorkflowModelPick;
  readonly snapshot: WorkflowRoutingAvailabilitySnapshot;
  readonly isExplicit?: boolean;
};

export const workflowRoutingAvailability = ({
  pick,
  snapshot,
  isExplicit = false,
}: Params): WorkflowRoutingAvailability => {
  const model = catalogModelForId({ provider: pick.provider, modelId: pick.model });
  if (model === null) {
    return { kind: 'unavailable', cause: 'unknown_model' };
  }
  if (
    isExplicit === false &&
    snapshot.hiddenModels != null &&
    isModelHidden({ provider: pick.provider, hidden: snapshot.hiddenModels, key: model.key })
  ) {
    return { kind: 'unavailable', cause: 'hidden' };
  }
  if (snapshot.connectedProviders.includes(pick.provider) === false) {
    return { kind: 'unavailable', cause: 'disconnected' };
  }
  if (snapshot.coolingDownProviders.includes(pick.provider) === true) {
    return { kind: 'unavailable', cause: 'cooldown' };
  }
  if (
    snapshot.isSessionBudgetBlocked === true ||
    snapshot.isRunBudgetBlocked === true ||
    snapshot.budgetBlockedProviders.includes(pick.provider) === true
  ) {
    return { kind: 'unavailable', cause: 'budget' };
  }
  return { kind: 'available' };
};
