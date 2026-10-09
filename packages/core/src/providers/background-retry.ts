import type { ProviderId, TaskModelPreference } from '@goodboy/types';
import type { HiddenModels } from './modelVisibility';
import type { TurnFailureKind } from './planTurnFallback';
import { planAlternateTaskModel } from './task-model-fallback';

export const BACKGROUND_MAX_ATTEMPTS = 4;
export const BACKGROUND_BUDGET_MS = 6 * 60 * 1000;
export const BACKGROUND_SAME_MODEL_BACKOFF_MS = 1500;

const TIMEOUT_PATTERN = /timed out|timeout/i;

export type BackgroundFailure = TurnFailureKind | 'timeout';

const SAME_MODEL_FAILURES: ReadonlyArray<BackgroundFailure> = ['other', 'unreachable'];

export type BackgroundAttempt = {
  readonly model: TaskModelPreference;
  readonly error: string;
  readonly failure: BackgroundFailure;
};

export type BackgroundPool = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly enabledProviders: ReadonlyArray<ProviderId> | null;
  readonly coolingDownProviders: ReadonlyArray<ProviderId>;
  readonly hidden?: HiddenModels | null;
};

type Params<T> = {
  readonly first: TaskModelPreference;
  readonly run: (model: TaskModelPreference) => Promise<T>;
  readonly classify: (error: string) => TurnFailureKind;
  readonly describe: (error: unknown) => string;
  readonly pool: () => BackgroundPool;
  readonly onFailure?: (attempt: BackgroundAttempt) => void;
  readonly shouldStop?: () => boolean;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly maxAttempts?: number;
  readonly budgetMs?: number;
};

export type BackgroundResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly model: TaskModelPreference;
      readonly attempts: ReadonlyArray<BackgroundAttempt>;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly model: TaskModelPreference;
      readonly attempts: ReadonlyArray<BackgroundAttempt>;
    };

type NextParams = {
  readonly first: TaskModelPreference;
  readonly attempts: ReadonlyArray<BackgroundAttempt>;
  readonly pool: BackgroundPool;
};

const sameModel = (left: TaskModelPreference, right: TaskModelPreference): boolean =>
  left.providerId === right.providerId && left.model === right.model;

const nextModel = ({ first, attempts, pool }: NextParams): TaskModelPreference | null => {
  const last = attempts[attempts.length - 1];
  if (last == null) {
    return null;
  }
  const isRepeat = attempts.filter((attempt) => sameModel(attempt.model, last.model)).length > 1;
  if (!isRepeat && SAME_MODEL_FAILURES.includes(last.failure)) {
    return last.model;
  }
  return planAlternateTaskModel({
    taskModel: first,
    connectedProviders: pool.connectedProviders,
    enabledProviders: pool.enabledProviders,
    coolingDownProviders: [
      ...pool.coolingDownProviders,
      ...attempts.map((attempt) => attempt.model.providerId),
    ],
    ...(pool.hidden != null && { hidden: pool.hidden }),
  });
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const runWithModelFallback = async <T>({
  first,
  run,
  classify,
  describe,
  pool,
  onFailure,
  shouldStop,
  now = Date.now,
  sleep = wait,
  maxAttempts = BACKGROUND_MAX_ATTEMPTS,
  budgetMs = BACKGROUND_BUDGET_MS,
}: Params<T>): Promise<BackgroundResult<T>> => {
  const startedAt = now();
  const attempts: BackgroundAttempt[] = [];
  let model = first;
  while (true) {
    try {
      const value = await run(model);
      return { ok: true, value, model, attempts };
    } catch (thrown) {
      const error = describe(thrown);
      const attempt: BackgroundAttempt = {
        model,
        error,
        failure: TIMEOUT_PATTERN.test(error) ? 'timeout' : classify(error),
      };
      attempts.push(attempt);
      onFailure?.(attempt);
    }
    if (
      shouldStop?.() === true ||
      attempts.length >= maxAttempts ||
      now() - startedAt >= budgetMs
    ) {
      break;
    }
    const next = nextModel({ first, attempts, pool: pool() });
    if (next === null) {
      break;
    }
    if (sameModel(next, model)) {
      await sleep(BACKGROUND_SAME_MODEL_BACKOFF_MS);
    }
    model = next;
  }
  return { ok: false, error: attempts[attempts.length - 1]?.error ?? '', model, attempts };
};
