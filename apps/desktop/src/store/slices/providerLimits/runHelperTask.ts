import {
  planAlternateTaskModel,
  runWithModelFallback,
  type BackgroundAttempt,
  type BackgroundPool,
  type BackgroundResult,
} from '@goodboy/core';
import type { ProviderId, SessionId, TaskModelPreference } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import {
  providersCoolingDown,
  withFailureCooldown,
  withProviderCooldown,
} from '../../../features/providers/taskModelRouting';
import type { GetFn, SetFn } from '../../slice-types';
import { sessionById } from '../sessions/sessionIndex';
import { selectHiddenModels } from '../settings/selectHiddenModels';

const HELPER_FAILURE_WINDOW_MS = 3 * 60 * 1000;

const COOLDOWN_FAILURES = ['usage_limit', 'authentication', 'rate_limit'];

type Params<T> = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId | null;
  readonly first: TaskModelPreference;
  readonly run: (model: TaskModelPreference) => Promise<T>;
  readonly shouldStop?: () => boolean;
  readonly budgetMs?: number;
};

type PoolParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId | null;
};

const failingProviders = ({ get }: Pick<PoolParams, 'get'>): ReadonlyArray<ProviderId> =>
  providersCoolingDown({ cooldowns: get().helperProviderFailures ?? {}, nowMs: Date.now() });

const poolFor = ({ get, sessionId }: PoolParams): BackgroundPool => {
  const session = sessionId == null ? null : sessionById(get().sessions, sessionId);
  return {
    connectedProviders: get()
      .providers.filter((provider) => provider.connection === 'connected')
      .map((provider) => provider.id),
    enabledProviders: session?.providerPreference.enabledProviders ?? null,
    coolingDownProviders: [
      ...providersCoolingDown({ cooldowns: get().providerCooldowns, nowMs: Date.now() }),
      ...failingProviders({ get }),
    ],
    hidden: selectHiddenModels({ state: get() }),
  };
};

const startModel = ({ get, sessionId, first }: PoolParams & { first: TaskModelPreference }) => {
  if (!failingProviders({ get }).includes(first.providerId)) {
    return first;
  }
  return planAlternateTaskModel({ taskModel: first, ...poolFor({ get, sessionId }) }) ?? first;
};

const providersFailingTwice = (
  attempts: ReadonlyArray<BackgroundAttempt>,
): ReadonlyArray<ProviderId> => {
  const counts = new Map<ProviderId, number>();
  for (const attempt of attempts) {
    counts.set(attempt.model.providerId, (counts.get(attempt.model.providerId) ?? 0) + 1);
  }
  return [...counts].flatMap(([provider, count]) => (count > 1 ? [provider] : []));
};

export const runHelperTask = async <T>({
  set,
  get,
  sessionId,
  first,
  run,
  shouldStop,
  budgetMs,
}: Params<T>): Promise<BackgroundResult<T>> => {
  const result = await runWithModelFallback({
    first: startModel({ get, sessionId, first }),
    run,
    classify: (message) => classifyProviderError({ message }).kind,
    describe: formatError,
    pool: () => poolFor({ get, sessionId }),
    onFailure: ({ model, error }) => {
      const failure = classifyProviderError({ message: error });
      if (!COOLDOWN_FAILURES.includes(failure.kind)) {
        return;
      }
      set((state) => ({
        providerCooldowns: withFailureCooldown({
          cooldowns: state.providerCooldowns,
          provider: model.providerId,
          failure,
          nowMs: Date.now(),
        }),
      }));
    },
    ...(shouldStop != null && { shouldStop }),
    ...(budgetMs != null && { budgetMs }),
  });
  const flaky = result.ok ? providersFailingTwice(result.attempts) : [];
  if (flaky.length > 0) {
    set((state) => ({
      helperProviderFailures: flaky.reduce(
        (windows, provider) =>
          withProviderCooldown({
            cooldowns: windows,
            provider,
            cooldownUntilMs: Date.now() + HELPER_FAILURE_WINDOW_MS,
          }),
        state.helperProviderFailures ?? {},
      ),
    }));
  }
  return result;
};
