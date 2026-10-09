import type { ProviderId, TaskModelPreference } from '@goodboy/types';
import { alignedProviderPlan, type TurnFailureKind } from './planTurnFallback';
import type { HiddenModels } from './modelVisibility';
import { taskModelProviderPool } from './providerFallbackPool';

export const MAX_TASK_MODEL_PROVIDER_ATTEMPTS = 1;

const FALLBACK_FAILURES: ReadonlyArray<TurnFailureKind> = [
  'usage_limit',
  'authentication',
  'rate_limit',
  'model_not_available',
  'cli_too_old',
];

type Params = {
  readonly failure: TurnFailureKind;
  readonly taskModel: TaskModelPreference;
  readonly attempt: number;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly enabledProviders: ReadonlyArray<ProviderId> | null;
  readonly coolingDownProviders: ReadonlyArray<ProviderId>;
  readonly hidden?: HiddenModels | null;
};

type AlternateParams = Pick<
  Params,
  'taskModel' | 'connectedProviders' | 'enabledProviders' | 'coolingDownProviders' | 'hidden'
>;

export const planAlternateTaskModel = ({
  taskModel,
  connectedProviders,
  enabledProviders,
  coolingDownProviders,
  hidden,
}: AlternateParams): TaskModelPreference | null => {
  const pool = taskModelProviderPool({
    provider: taskModel.providerId,
    connectedProviders,
    enabledProviders,
    coolingDownProviders,
  });
  const plan = alignedProviderPlan({
    provider: taskModel.providerId,
    model: taskModel.model,
    candidateProviders: pool,
    wantsThinker: false,
    ...(hidden != null && { hidden }),
  });
  if (plan == null) {
    return null;
  }
  return { providerId: plan.provider, model: plan.model };
};

export const planTaskModelFallback = ({
  failure,
  taskModel,
  attempt,
  connectedProviders,
  enabledProviders,
  coolingDownProviders,
  hidden,
}: Params): TaskModelPreference | null => {
  if (attempt >= MAX_TASK_MODEL_PROVIDER_ATTEMPTS) {
    return null;
  }
  if (!FALLBACK_FAILURES.includes(failure)) {
    return null;
  }
  return planAlternateTaskModel({
    taskModel,
    connectedProviders,
    enabledProviders,
    coolingDownProviders,
    ...(hidden != null && { hidden }),
  });
};
