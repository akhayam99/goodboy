import type {
  IsoDateTime,
  ProviderLimitStatus,
  ProviderLimitWindow,
  ProviderLimitWindowKind,
  ProviderLimits,
} from '@goodboy/types';
import { epochSecondsToIso } from './epochSecondsToIso';
import { sortLimitWindows } from './sortLimitWindows';

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

const UNIFIED_WINDOW_KEYS = ['five_hour', 'seven_day'] as const;

type UnifiedParams = {
  readonly info: object;
  readonly rawType: unknown;
  readonly status: ProviderLimitStatus;
};

const unifiedWindowsOf = ({
  info,
  rawType,
  status,
}: UnifiedParams): ReadonlyArray<ProviderLimitWindow> => {
  const unified: unknown = Reflect.get(info, 'unifiedWindows');
  if (typeof unified !== 'object' || unified === null) {
    return [];
  }
  return UNIFIED_WINDOW_KEYS.flatMap((key) => {
    const entry: unknown = Reflect.get(unified, key);
    const window = CLAUDE_WINDOWS[key];
    if (typeof entry !== 'object' || entry === null || window === undefined) {
      return [];
    }
    const windowStatus: ProviderLimitStatus = key === rawType ? status : 'ok';
    return [
      {
        kind: window.kind,
        model: window.model,
        status: windowStatus,
        usedFraction: usedFractionOf({
          value: Reflect.get(entry, 'utilization'),
          status: windowStatus,
        }),
        resetsAt: epochSecondsToIso({ value: Reflect.get(entry, 'resetsAt') }),
      },
    ];
  });
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
  if (status === undefined) {
    return null;
  }
  const unified = unifiedWindowsOf({ info, rawType, status });
  const isCoveredByUnified =
    window !== undefined &&
    unified.some((entry) => entry.kind === window.kind && entry.model === window.model);
  const topLevel: ReadonlyArray<ProviderLimitWindow> =
    window === undefined || isCoveredByUnified
      ? []
      : [
          {
            kind: window.kind,
            model: window.model,
            status,
            usedFraction: usedFractionOf({ value: Reflect.get(info, 'utilization'), status }),
            resetsAt: epochSecondsToIso({ value: Reflect.get(info, 'resetsAt') }),
          },
        ];
  const windows = sortLimitWindows({ windows: [...unified, ...topLevel] });
  if (windows.length === 0) {
    return null;
  }
  return { providerId: 'anthropic', plan: null, status, windows, observedAt };
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
