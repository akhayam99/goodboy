import type { AppStore } from '../../store';
import { accountIdOf } from './accountIdOf';
import { accountPlanOf } from './accountPlanOf';
import { UNAVAILABLE_MODEL_TTL_MS, type UnavailableModel } from './unavailableModelsSetting';

export type RefusedModelsState = Partial<
  Pick<AppStore, 'unavailableModels' | 'providers' | 'authResults' | 'providerLimits'>
>;

type Params = {
  readonly state: RefusedModelsState;
  readonly nowMs: number;
};

type LiveParams = Params & {
  readonly entry: UnavailableModel;
};

const isLive = ({ state, nowMs, entry }: LiveParams): boolean => {
  const providers = state.providers ?? [];
  if (entry.accountId !== accountIdOf({ providers, providerId: entry.providerId })) {
    return false;
  }
  const plan = accountPlanOf({ state, providerId: entry.providerId });
  if (entry.plan !== null && plan !== null && entry.plan !== plan) {
    return false;
  }
  return nowMs - entry.checkedAt < UNAVAILABLE_MODEL_TTL_MS;
};

export const selectRefusedModels = ({ state, nowMs }: Params): ReadonlyArray<UnavailableModel> =>
  (state.unavailableModels ?? []).filter((entry) => isLive({ state, nowMs, entry }));
