import type { CostRange, DurationEstimate, EstimateTier } from '@goodboy/core';
import { formatUsd } from '@goodboy/ui';
import { formatDuration } from '../chat/utils/format-duration';
import type { RowPhase } from './rowState';

export type WorkEstimate = {
  readonly p25Ms: number;
  readonly p50Ms: number;
  readonly p75Ms: number;
  readonly isFallback: boolean;
  readonly basis: string;
};

export type WorkTime = {
  readonly label: string;
  readonly detail: string;
  readonly progress: number | null;
};

const MINUTE_MS = 60_000;
const NARROW_BAND = 1.3;
const MACHINE_TIME_NOTE = 'Waiting on you is not counted.';

type MsParams = {
  readonly ms: number;
};

export const formatActiveTime = ({ ms }: MsParams): string => {
  const seconds = Math.floor(ms / 1_000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 60)}h ${rest}m`;
};

const exactActiveTime = ({ ms }: MsParams): string =>
  ms < 1_000 ? '0s' : formatDuration({ durationMs: ms });

const estimateMinutes = ({ ms }: MsParams): number => {
  const minutes = ms / MINUTE_MS;
  if (minutes <= 20) {
    return Math.max(1, Math.round(minutes));
  }
  return Math.round(minutes / 5) * 5;
};

const minutesLabel = ({ minutes }: { readonly minutes: number }): string => {
  if (minutes < 120) {
    return `${minutes}m`;
  }
  return `${Math.round(minutes / 30) / 2}h`;
};

export const formatEstimateTime = ({ ms }: MsParams): string =>
  minutesLabel({ minutes: estimateMinutes({ ms }) });

type RangeParams = {
  readonly p25Ms: number;
  readonly p50Ms: number;
  readonly p75Ms: number;
};

export const formatEstimateRange = ({ p25Ms, p50Ms, p75Ms }: RangeParams): string => {
  if (p75Ms < 2 * MINUTE_MS) {
    return '<2m';
  }
  if (p25Ms > 0 && p75Ms / p25Ms < NARROW_BAND) {
    return `≈ ${formatEstimateTime({ ms: p50Ms })}`;
  }
  const low = estimateMinutes({ ms: p25Ms });
  const high = estimateMinutes({ ms: p75Ms });
  if (low >= high) {
    return `≈ ${minutesLabel({ minutes: high })}`;
  }
  if (high < 120) {
    return `${low}-${high}m`;
  }
  return `${minutesLabel({ minutes: low })}-${minutesLabel({ minutes: high })}`;
};

export const formatCostRange = ({ p25Usd, p75Usd }: CostRange): string => {
  const low = formatUsd(p25Usd);
  const high = formatUsd(p75Usd);
  if (low === high) {
    return `≈ ${high}`;
  }
  return `${low}-${high.replace('$', '')}`;
};

const FALLBACK_TIERS: ReadonlySet<EstimateTier> = new Set<EstimateTier>([
  'model',
  'provider',
  'role',
]);

export const isFallbackTier = ({ tier }: { readonly tier: EstimateTier }): boolean =>
  FALLBACK_TIERS.has(tier);

type EstimateParams = {
  readonly estimate: DurationEstimate;
  readonly basis: string;
};

export const workEstimateOf = ({ estimate, basis }: EstimateParams): WorkEstimate => ({
  p25Ms: estimate.p25Ms,
  p50Ms: estimate.p50Ms,
  p75Ms: estimate.p75Ms,
  isFallback: isFallbackTier({ tier: estimate.tier }),
  basis,
});

type LabelParams = {
  readonly estimate: WorkEstimate;
};

export const estimateRangeLabel = ({ estimate }: LabelParams): string => {
  const range = formatEstimateRange(estimate);
  return estimate.isFallback && !range.startsWith('≈') ? `~${range}` : range;
};

type Params = {
  readonly phase: RowPhase;
  readonly activeMs: number;
  readonly hasStarted: boolean;
  readonly estimate: WorkEstimate | null;
  readonly unknownBasis: string | null;
};

const runningTime = ({
  activeMs,
  estimate,
  unknownBasis,
}: Omit<Params, 'phase' | 'hasStarted'>) => {
  const active = formatActiveTime({ ms: activeMs });
  const exact = `Active ${exactActiveTime({ ms: activeMs })}. ${MACHINE_TIME_NOTE}`;
  if (estimate === null) {
    return {
      label: active,
      detail: unknownBasis === null ? exact : `${exact} ${unknownBasis}`,
      progress: null,
    };
  }
  const usual = `~${formatEstimateTime({ ms: estimate.p75Ms })}`;
  const detail = `${exact} Most finish within ${usual}. ${estimate.basis}`;
  if (activeMs > estimate.p75Ms) {
    return { label: `${active}, usually ${usual}`, detail, progress: 1 };
  }
  return {
    label: `${active} of ${usual}`,
    detail,
    progress: estimate.p75Ms === 0 ? 1 : activeMs / estimate.p75Ms,
  };
};

const pausedTime = ({
  activeMs,
  estimate,
  unknownBasis,
}: Omit<Params, 'phase' | 'hasStarted'>): WorkTime => {
  const running = runningTime({ activeMs, estimate, unknownBasis });
  const active = formatActiveTime({ ms: activeMs });
  if (estimate === null || activeMs > estimate.p75Ms) {
    return { ...running, label: `Paused, ${active}` };
  }
  return {
    ...running,
    label: `Paused, ${active} of ~${formatEstimateTime({ ms: estimate.p75Ms })}`,
  };
};

const queuedTime = ({ estimate }: { readonly estimate: WorkEstimate | null }): WorkTime | null => {
  if (estimate === null) {
    return null;
  }
  const range = estimateRangeLabel({ estimate });
  return { label: range, detail: `Usually ${range}. ${estimate.basis}`, progress: null };
};

export const workTime = ({
  phase,
  activeMs,
  hasStarted,
  estimate,
  unknownBasis,
}: Params): WorkTime | null => {
  const exact = `Active ${exactActiveTime({ ms: activeMs })}. ${MACHINE_TIME_NOTE}`;
  switch (phase) {
    case 'queued':
      return queuedTime({ estimate });
    case 'running':
      return runningTime({ activeMs, estimate, unknownBasis });
    case 'waiting':
      return hasStarted
        ? pausedTime({ activeMs, estimate, unknownBasis })
        : queuedTime({ estimate });
    case 'failed':
      return hasStarted
        ? {
            label: `Failed after ${formatActiveTime({ ms: activeMs })}`,
            detail: exact,
            progress: null,
          }
        : null;
    case 'done':
    case 'closed':
      return hasStarted
        ? { label: exactActiveTime({ ms: activeMs }), detail: exact, progress: null }
        : null;
    case 'skipped':
      return null;
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};
