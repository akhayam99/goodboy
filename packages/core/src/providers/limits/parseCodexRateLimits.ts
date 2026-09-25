import type { IsoDateTime, ProviderLimitWindow, ProviderLimits } from '@goodboy/types';
import { LIMITS_FIVE_HOUR_MAX_MINUTES } from './constants';
import { epochSecondsToIso } from './epochSecondsToIso';
import { providerLimitsStatus, windowStatus } from './providerLimitsStatus';

type WindowParams = {
  readonly value: unknown;
};

const codexWindow = ({ value }: WindowParams): ProviderLimitWindow | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const usedPercent: unknown = Reflect.get(value, 'used_percent');
  const minutes: unknown = Reflect.get(value, 'window_minutes');
  if (typeof usedPercent !== 'number' || !Number.isFinite(usedPercent)) {
    return null;
  }
  if (typeof minutes !== 'number' || minutes <= 0) {
    return null;
  }
  const draft: ProviderLimitWindow = {
    kind: minutes < LIMITS_FIVE_HOUR_MAX_MINUTES ? 'fiveHour' : 'weekly',
    model: null,
    status: 'ok',
    usedFraction: Math.min(Math.max(usedPercent / 100, 0), 1),
    resetsAt: epochSecondsToIso({ value: Reflect.get(value, 'resets_at') }),
  };
  return { ...draft, status: windowStatus({ window: draft }) };
};

type PlanParams = {
  readonly value: unknown;
};

const planOf = ({ value }: PlanParams): string | null => {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const plan = value.trim();
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
};

type ReachedParams = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
};

const markMostUsedReached = ({ windows }: ReachedParams): ReadonlyArray<ProviderLimitWindow> => {
  const mostUsed = windows.reduce<ProviderLimitWindow | null>(
    (best, window) =>
      best === null || (window.usedFraction ?? 0) > (best.usedFraction ?? 0) ? window : best,
    null,
  );
  return windows.map((window) =>
    window === mostUsed ? { ...window, status: 'reached', usedFraction: 1 } : window,
  );
};

type Params = {
  readonly value: unknown;
  readonly observedAt: IsoDateTime;
};

export const parseCodexRateLimits = ({ value, observedAt }: Params): ProviderLimits | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const parsed = [
    codexWindow({ value: Reflect.get(value, 'primary') }),
    codexWindow({ value: Reflect.get(value, 'secondary') }),
  ].filter((window): window is ProviderLimitWindow => window !== null);
  if (parsed.length === 0) {
    return null;
  }
  const reachedType: unknown = Reflect.get(value, 'rate_limit_reached_type');
  const isReached = typeof reachedType === 'string' && reachedType !== '';
  const hasReachedWindow = parsed.some((window) => window.status === 'reached');
  const windows =
    isReached && !hasReachedWindow ? markMostUsedReached({ windows: parsed }) : parsed;
  return {
    providerId: 'codex',
    plan: planOf({ value: Reflect.get(value, 'plan_type') }),
    status: providerLimitsStatus({ windows }),
    windows,
    observedAt,
  };
};
