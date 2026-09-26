import type { CodexResetCredits, IsoDateTime, ProviderLimits } from '@goodboy/types';
import { epochSecondsToIso } from './epochSecondsToIso';
import { parseCodexRateLimits } from './parseCodexRateLimits';

type ObjectParams = {
  readonly value: unknown;
  readonly key: string;
};

const field = ({ value, key }: ObjectParams): unknown =>
  typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;

const snakeWindow = ({ value }: { readonly value: unknown }): unknown => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return {
    used_percent: field({ value, key: 'usedPercent' }),
    window_minutes: field({ value, key: 'windowDurationMins' }),
    resets_at: field({ value, key: 'resetsAt' }),
  };
};

const codexSnapshot = ({ value }: { readonly value: unknown }): unknown => {
  const byId = field({ value: field({ value, key: 'rateLimitsByLimitId' }), key: 'codex' });
  if (typeof byId === 'object' && byId !== null) {
    return byId;
  }
  return field({ value, key: 'rateLimits' });
};

type Params = {
  readonly value: unknown;
  readonly observedAt: IsoDateTime;
};

export const parseCodexAppServerLimits = ({ value, observedAt }: Params): ProviderLimits | null => {
  const snapshot = codexSnapshot({ value });
  if (typeof snapshot !== 'object' || snapshot === null) {
    return null;
  }
  return parseCodexRateLimits({
    value: {
      primary: snakeWindow({ value: field({ value: snapshot, key: 'primary' }) }),
      secondary: snakeWindow({ value: field({ value: snapshot, key: 'secondary' }) }),
      plan_type: field({ value: snapshot, key: 'planType' }),
      rate_limit_reached_type: field({ value: snapshot, key: 'rateLimitReachedType' }),
    },
    observedAt,
  });
};

type Credit = {
  readonly id: string | null;
  readonly expiresAt: IsoDateTime | null;
};

const expiryRank = ({ credit }: { readonly credit: Credit }): number =>
  credit.expiresAt === null ? Number.POSITIVE_INFINITY : Date.parse(credit.expiresAt);

const availableCredits = ({ value }: { readonly value: unknown }): ReadonlyArray<Credit> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((credit) => field({ value: credit, key: 'status' }) === 'available')
    .map((credit) => {
      const id = field({ value: credit, key: 'id' });
      return {
        id: typeof id === 'string' && id !== '' ? id : null,
        expiresAt: epochSecondsToIso({ value: field({ value: credit, key: 'expiresAt' }) }),
      };
    })
    .sort((a, b) => expiryRank({ credit: a }) - expiryRank({ credit: b }));
};

export const parseCodexResetCredits = ({ value, observedAt }: Params): CodexResetCredits | null => {
  const summary = field({ value, key: 'rateLimitResetCredits' });
  const count = field({ value: summary, key: 'availableCount' });
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
    return null;
  }
  const first = availableCredits({ value: field({ value: summary, key: 'credits' }) })[0] ?? null;
  return {
    availableCount: Math.floor(count),
    creditId: first?.id ?? null,
    expiresAt: first?.expiresAt ?? null,
    observedAt,
  };
};
