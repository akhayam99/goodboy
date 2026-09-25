import type {
  IsoDateTime,
  ProviderId,
  ProviderLimitStatus,
  ProviderLimitWindow,
  ProviderLimits,
} from '@goodboy/types';
import { LIMITS_STALE_MS } from './constants';
import { windowStatus } from './providerLimitsStatus';

export const LIMITS_CHIP_PROVIDERS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'codex',
  'gemini',
  'cursor',
];

export const PROVIDERS_REPORTING_LIMITS: ReadonlyArray<ProviderId> = ['anthropic', 'codex'];

export type LimitsChipState = 'normal' | 'warning' | 'out' | 'stale' | 'reset' | 'waiting' | 'none';

export type LimitsChip = Readonly<{
  providerId: ProviderId;
  state: LimitsChipState;
  plan: string | null;
  window: ProviderLimitWindow | null;
  windows: ReadonlyArray<ProviderLimitWindow>;
  usedFraction: number | null;
  resetsAt: IsoDateTime | null;
  observedAt: IsoDateTime | null;
  isStale: boolean;
}>;

const STATUS_RANK: Readonly<Record<ProviderLimitStatus, number>> = {
  ok: 0,
  warning: 1,
  reached: 2,
};

type CompareParams = {
  readonly left: ProviderLimitWindow;
  readonly right: ProviderLimitWindow;
};

const isMoreUsed = ({ left, right }: CompareParams): boolean => {
  const rankDelta =
    STATUS_RANK[windowStatus({ window: left })] - STATUS_RANK[windowStatus({ window: right })];
  if (rankDelta !== 0) {
    return rankDelta > 0;
  }
  return (left.usedFraction ?? -1) > (right.usedFraction ?? -1);
};

type WindowsParams = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
};

export const mostUsedWindow = ({ windows }: WindowsParams): ProviderLimitWindow | null =>
  windows.reduce<ProviderLimitWindow | null>(
    (best, window) => (best === null || isMoreUsed({ left: window, right: best }) ? window : best),
    null,
  );

type OpenParams = {
  readonly windows: ReadonlyArray<ProviderLimitWindow>;
  readonly nowMs: number;
};

export const openWindows = ({ windows, nowMs }: OpenParams): ReadonlyArray<ProviderLimitWindow> =>
  windows.filter((window) => window.resetsAt === null || Date.parse(window.resetsAt) > nowMs);

type ChipParams = {
  readonly providerId: ProviderId;
  readonly limits: ProviderLimits | undefined;
  readonly nowMs: number;
};

type EmptyChipParams = {
  readonly providerId: ProviderId;
  readonly state: LimitsChipState;
};

const emptyChip = ({ providerId, state }: EmptyChipParams): LimitsChip => ({
  providerId,
  state,
  plan: null,
  window: null,
  windows: [],
  usedFraction: null,
  resetsAt: null,
  observedAt: null,
  isStale: false,
});

const STATE_OF_STATUS: Readonly<Record<ProviderLimitStatus, LimitsChipState>> = {
  ok: 'normal',
  warning: 'warning',
  reached: 'out',
};

export const limitsChipOf = ({ providerId, limits, nowMs }: ChipParams): LimitsChip => {
  if (!PROVIDERS_REPORTING_LIMITS.includes(providerId)) {
    return emptyChip({ providerId, state: 'none' });
  }
  if (limits === undefined) {
    return emptyChip({ providerId, state: 'waiting' });
  }
  const isStale = nowMs - Date.parse(limits.observedAt) > LIMITS_STALE_MS;
  const open = openWindows({ windows: limits.windows, nowMs });
  const window = mostUsedWindow({ windows: open });
  const base = {
    providerId,
    plan: limits.plan,
    windows: open,
    observedAt: limits.observedAt,
    isStale,
  };
  if (window === null) {
    const lastReset = mostUsedWindow({ windows: limits.windows });
    return {
      ...base,
      state: limits.windows.length > 0 ? 'reset' : 'waiting',
      window: null,
      usedFraction: null,
      resetsAt: lastReset?.resetsAt ?? null,
    };
  }
  const fromStatus = STATE_OF_STATUS[windowStatus({ window })];
  return {
    ...base,
    state: fromStatus === 'normal' && isStale ? 'stale' : fromStatus,
    window,
    usedFraction: windowStatus({ window }) === 'reached' ? 1 : window.usedFraction,
    resetsAt: window.resetsAt,
  };
};

type Params = {
  readonly order: ReadonlyArray<ProviderId>;
  readonly connected: ReadonlyArray<ProviderId>;
  readonly limits: Readonly<Partial<Record<ProviderId, ProviderLimits>>>;
  readonly nowMs: number;
};

export const selectLimitsChips = ({
  order,
  connected,
  limits,
  nowMs,
}: Params): ReadonlyArray<LimitsChip> => {
  const ordered = [...new Set([...order, ...LIMITS_CHIP_PROVIDERS])].filter(
    (providerId) => LIMITS_CHIP_PROVIDERS.includes(providerId) && connected.includes(providerId),
  );
  const chips = ordered.map((providerId) =>
    limitsChipOf({ providerId, limits: limits[providerId], nowMs }),
  );
  return [
    ...chips.filter((chip) => chip.state !== 'none'),
    ...chips.filter((chip) => chip.state === 'none'),
  ];
};

const CHIP_SEVERITY: Readonly<Record<LimitsChipState, number>> = {
  none: 0,
  waiting: 0,
  reset: 0,
  stale: 0,
  normal: 0,
  warning: 1,
  out: 2,
};

type WorstParams = {
  readonly chips: ReadonlyArray<LimitsChip>;
};

export const worstLimitsChip = ({ chips }: WorstParams): LimitsChip | null =>
  chips.reduce<LimitsChip | null>((worst, chip) => {
    if (CHIP_SEVERITY[chip.state] === 0) {
      return worst;
    }
    return worst === null || CHIP_SEVERITY[chip.state] > CHIP_SEVERITY[worst.state] ? chip : worst;
  }, null);
