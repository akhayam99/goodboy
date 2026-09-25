import type {
  IsoDateTime,
  ProviderLimitStatus,
  ProviderLimitWindowKind,
  ProviderLimits,
} from '@goodboy/types';
import { epochSecondsToIso } from './epochSecondsToIso';

type ClaudeWindow = {
  readonly kind: ProviderLimitWindowKind;
  readonly model: string | null;
};

const CLAUDE_WINDOWS: Readonly<Record<string, ClaudeWindow>> = {
  five_hour: { kind: 'fiveHour', model: null },
  seven_day: { kind: 'weekly', model: null },
  seven_day_opus: { kind: 'weeklyModel', model: 'Opus' },
  seven_day_sonnet: { kind: 'weeklyModel', model: 'Sonnet' },
};

const CLAUDE_STATUS: Readonly<Record<string, ProviderLimitStatus>> = {
  allowed: 'ok',
  allowed_warning: 'warning',
  rejected: 'reached',
};

type FractionParams = {
  readonly value: unknown;
  readonly status: ProviderLimitStatus;
};

const usedFractionOf = ({ value, status }: FractionParams): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(Math.max(value, 0), 1);
  }
  return status === 'reached' ? 1 : null;
};

type Params = {
  readonly value: unknown;
  readonly observedAt: IsoDateTime;
};

export const parseClaudeRateLimitEvent = ({ value, observedAt }: Params): ProviderLimits | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  if (Reflect.get(value, 'type') !== 'rate_limit_event') {
    return null;
  }
  const info: unknown = Reflect.get(value, 'rate_limit_info');
  if (typeof info !== 'object' || info === null) {
    return null;
  }
  const rawStatus: unknown = Reflect.get(info, 'status');
  const rawType: unknown = Reflect.get(info, 'rateLimitType');
  const status = typeof rawStatus === 'string' ? CLAUDE_STATUS[rawStatus] : undefined;
  const window = typeof rawType === 'string' ? CLAUDE_WINDOWS[rawType] : undefined;
  if (status === undefined || window === undefined) {
    return null;
  }
  return {
    providerId: 'anthropic',
    plan: null,
    status,
    windows: [
      {
        kind: window.kind,
        model: window.model,
        status,
        usedFraction: usedFractionOf({ value: Reflect.get(info, 'utilization'), status }),
        resetsAt: epochSecondsToIso({ value: Reflect.get(info, 'resetsAt') }),
      },
    ],
    observedAt,
  };
};

type LineParams = {
  readonly line: string;
  readonly observedAt: IsoDateTime;
};

export type ClaudeRateLimitLine = Readonly<{ limits: ProviderLimits | null }>;

export const readClaudeRateLimitLine = ({
  line,
  observedAt,
}: LineParams): ClaudeRateLimitLine | null => {
  if (!line.includes('"rate_limit_event"')) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(line);
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    if (Reflect.get(value, 'type') !== 'rate_limit_event') {
      return null;
    }
    return { limits: parseClaudeRateLimitEvent({ value, observedAt }) };
  } catch {
    return null;
  }
};
