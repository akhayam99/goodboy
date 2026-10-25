import type { CostRange, DurationEstimate, EstimateTier } from '@goodboy/core';
import { formatUsd, type Fact } from '@goodboy/ui';
import { formatDuration } from '../../shared/utils/time/formatDuration';
import type { RowPhase } from './rowState';
import { quietSentence } from './rowStateCopy';

export type WorkEstimate = {
  readonly lowMs: number;
  readonly midMs: number;
  readonly highMs: number;
  readonly isFallback: boolean;
  readonly basis: string;
};

export type WorkTime = {
  readonly label: string;
  readonly detail: string;
  readonly facts: ReadonlyArray<Fact>;
  readonly footnote: string | null;
  readonly progress: number | null;
  readonly headline: string;
  readonly note: string | null;
  readonly isMuchLonger: boolean;
  readonly isQuiet?: boolean;
};

const MINUTE_MS = 60_000;
const NARROW_BAND = 1.3;
const MACHINE_TIME_NOTE = 'Waiting on you is not counted.';
const LONGER_THAN_USUAL = 'Longer than usual';
const MUCH_LONGER_FACTOR = 2;
export const QUIET_TURN_AFTER_MS = 5 * MINUTE_MS;

type MsParams = {
  readonly ms: number;
};

const exactActiveTime = ({ ms }: MsParams): string => formatDuration({ durationMs: ms }) ?? '';

export const formatActiveTime = ({ ms }: MsParams): string => exactActiveTime({ ms });

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

const formatEstimateTime = ({ ms }: MsParams): string =>
  minutesLabel({ minutes: estimateMinutes({ ms }) });

type RangeParams = {
  readonly lowMs: number;
  readonly midMs: number;
  readonly highMs: number;
};

export const formatEstimateRange = ({ lowMs, midMs, highMs }: RangeParams): string => {
  if (highMs < 2 * MINUTE_MS) {
    return '<2m';
  }
  if (lowMs > 0 && highMs / lowMs < NARROW_BAND) {
    return `≈ ${formatEstimateTime({ ms: midMs })}`;
  }
  const low = estimateMinutes({ ms: lowMs });
  const high = estimateMinutes({ ms: highMs });
  if (low >= high) {
    return `≈ ${minutesLabel({ minutes: high })}`;
  }
  if (high < 120) {
    return `${low}-${high}m`;
  }
  return `${minutesLabel({ minutes: low })}-${minutesLabel({ minutes: high })}`;
};

export const formatCostRange = ({ lowUsd, highUsd }: CostRange): string => {
  const low = formatUsd(lowUsd);
  const high = formatUsd(highUsd);
  if (low === high) {
    return `≈ ${high}`;
  }
  return `${low}-${high.replace('$', '')}`;
};

const FALLBACK_TIERS: ReadonlySet<EstimateTier> = new Set<EstimateTier>([
  'model',
  'modelAnyWorkspace',
  'provider',
  'role',
]);

const isFallbackTier = ({ tier }: { readonly tier: EstimateTier }): boolean =>
  FALLBACK_TIERS.has(tier);

type EstimateParams = {
  readonly estimate: DurationEstimate;
  readonly basis: string;
};

export const workEstimateOf = ({ estimate, basis }: EstimateParams): WorkEstimate => ({
  lowMs: estimate.lowMs,
  midMs: estimate.midMs,
  highMs: estimate.highMs,
  isFallback: isFallbackTier({ tier: estimate.tier }),
  basis,
});

type PlainParams = {
  readonly label: string;
  readonly detail: string;
  readonly facts?: ReadonlyArray<Fact>;
  readonly footnote?: string | null;
  readonly progress?: number | null;
};

export const plainWorkTime = ({
  label,
  detail,
  facts = [],
  footnote = null,
  progress = null,
}: PlainParams): WorkTime => ({
  label,
  detail,
  facts,
  footnote,
  progress,
  headline: label,
  note: null,
  isMuchLonger: false,
  isQuiet: false,
});

const approxRangeLabel = ({ lowMs, midMs, highMs }: RangeParams): string => {
  const range = formatEstimateRange({ lowMs, midMs, highMs });
  if (range.startsWith('<')) {
    return range;
  }
  return range.startsWith('≈ ') ? `~${range.slice(2)}` : `~${range}`;
};

export const usualRangeLabel = ({ lowMs, midMs, highMs }: RangeParams): string =>
  approxRangeLabel({ lowMs, midMs, highMs }).replace(/^~/, '');

type LeftParams = {
  readonly lowMs: number;
  readonly highMs: number;
};

export const TIME_LEFT_SUFFIX = ' left';

const LEFT_RANGE_MAX_CHARS = 7;

export const timeLeftLabel = ({ lowMs, highMs }: LeftParams): string => {
  const range = lowMs > 0 ? approxRangeLabel({ lowMs, midMs: (lowMs + highMs) / 2, highMs }) : null;
  const shown =
    range !== null && range.length <= LEFT_RANGE_MAX_CHARS
      ? range
      : `~${formatEstimateTime({ ms: highMs })}`;
  return `${shown}${TIME_LEFT_SUFFIX}`;
};

type Params = {
  readonly phase: RowPhase;
  readonly activeMs: number;
  readonly hasStarted: boolean;
  readonly estimate: WorkEstimate | null;
  readonly unknownBasis: string | null;
  readonly quietMs?: number | null;
};

type ActiveParams = Omit<Params, 'phase' | 'hasStarted' | 'quietMs'>;

type QuietTimeParams = {
  readonly time: WorkTime;
  readonly quietMs: number;
};

type LongerParams = {
  readonly lead: string;
  readonly estimate: WorkEstimate;
};

type LongerFactsParams = {
  readonly estimate: WorkEstimate;
};

const longerFacts = ({ estimate }: LongerFactsParams): ReadonlyArray<Fact> => [
  { label: 'Most finish within', value: formatEstimateTime({ ms: estimate.highMs }) },
];

const longerFootnote = ({ estimate }: LongerFactsParams): string =>
  `${estimate.basis} ${MACHINE_TIME_NOTE}`;

const longerDetail = ({ lead, estimate }: LongerParams): string =>
  `${lead} Most finish within ${formatEstimateTime({ ms: estimate.highMs })}. ${estimate.basis} ${MACHINE_TIME_NOTE}`;

const runningTime = ({ activeMs, estimate, unknownBasis }: ActiveParams): WorkTime => {
  const elapsed = formatActiveTime({ ms: activeMs });
  const lead = `Running ${exactActiveTime({ ms: activeMs })}.`;
  if (estimate === null) {
    return plainWorkTime({
      label: elapsed,
      detail:
        unknownBasis === null
          ? `${lead} ${MACHINE_TIME_NOTE}`
          : `${lead} ${unknownBasis} ${MACHINE_TIME_NOTE}`,
      facts: [{ label: 'Running', value: exactActiveTime({ ms: activeMs }) }],
      footnote: unknownBasis === null ? MACHINE_TIME_NOTE : `${unknownBasis} ${MACHINE_TIME_NOTE}`,
    });
  }
  if (activeMs > estimate.highMs) {
    return {
      label: elapsed,
      detail: longerDetail({ lead, estimate }),
      facts: [
        { label: 'Running', value: exactActiveTime({ ms: activeMs }) },
        ...longerFacts({ estimate }),
      ],
      footnote: longerFootnote({ estimate }),
      progress: 1,
      headline: `${elapsed} · ${LONGER_THAN_USUAL.toLowerCase()}`,
      note: LONGER_THAN_USUAL,
      isMuchLonger: activeMs >= MUCH_LONGER_FACTOR * estimate.highMs,
      isQuiet: false,
    };
  }
  const left = timeLeftLabel({
    lowMs: Math.max(0, estimate.lowMs - activeMs),
    highMs: estimate.highMs - activeMs,
  });
  return {
    label: left,
    detail: `${lead} Usually ${usualRangeLabel(estimate)}. ${estimate.basis} ${MACHINE_TIME_NOTE}`,
    facts: [
      { label: 'Running', value: exactActiveTime({ ms: activeMs }) },
      { label: 'Usually', value: usualRangeLabel(estimate) },
    ],
    footnote: `${estimate.basis} ${MACHINE_TIME_NOTE}`,
    progress: estimate.highMs === 0 ? 1 : activeMs / estimate.highMs,
    headline: `${elapsed} · ${left}`,
    note: null,
    isMuchLonger: false,
    isQuiet: false,
  };
};

const quietTime = ({ time, quietMs }: QuietTimeParams): WorkTime => {
  const sentence = quietSentence({ quietMs });
  return {
    ...time,
    label: time.headline.split(' · ')[0] ?? time.label,
    detail: `${time.detail} ${sentence}: no output and no CPU in the process tree. It keeps running until you stop it.`,
    facts: [...time.facts, { label: 'Quiet', value: sentence.replace('Quiet for ', '') }],
    progress: null,
    headline: `${time.headline.split(' · ')[0] ?? time.label} · ${sentence.toLowerCase()}`,
    note: sentence,
    isQuiet: true,
  };
};

const pausedTime = ({ activeMs, estimate }: Omit<ActiveParams, 'unknownBasis'>): WorkTime =>
  plainWorkTime({
    label: formatActiveTime({ ms: activeMs }),
    detail: `Active ${exactActiveTime({ ms: activeMs })}. ${MACHINE_TIME_NOTE}`,
    facts: [{ label: 'Active', value: exactActiveTime({ ms: activeMs }) }],
    footnote: MACHINE_TIME_NOTE,
    progress:
      estimate === null || estimate.highMs === 0 ? null : Math.min(1, activeMs / estimate.highMs),
  });

const doneTime = ({ activeMs, estimate }: Omit<ActiveParams, 'unknownBasis'>): WorkTime => {
  const duration = exactActiveTime({ ms: activeMs });
  const lead = `Active ${duration}.`;
  if (estimate === null || activeMs <= estimate.highMs) {
    return plainWorkTime({
      label: duration,
      detail: `${lead} ${MACHINE_TIME_NOTE}`,
      facts: [{ label: 'Active', value: duration }],
      footnote: MACHINE_TIME_NOTE,
    });
  }
  return {
    label: duration,
    detail: longerDetail({ lead, estimate }),
    facts: [{ label: 'Active', value: duration }, ...longerFacts({ estimate })],
    footnote: longerFootnote({ estimate }),
    progress: null,
    headline: `${duration} · ${LONGER_THAN_USUAL.toLowerCase()}`,
    note: LONGER_THAN_USUAL,
    isMuchLonger: false,
    isQuiet: false,
  };
};

const queuedTime = ({ estimate }: { readonly estimate: WorkEstimate | null }): WorkTime | null => {
  if (estimate === null) {
    return null;
  }
  const range = approxRangeLabel(estimate);
  return plainWorkTime({
    label: range,
    detail: `Usually ${usualRangeLabel(estimate)}. ${estimate.basis}`,
    facts: [{ label: 'Usually', value: usualRangeLabel(estimate) }],
    footnote: estimate.basis,
  });
};

export const workTime = ({
  phase,
  activeMs,
  hasStarted,
  estimate,
  unknownBasis,
  quietMs = null,
}: Params): WorkTime | null => {
  switch (phase) {
    case 'queued':
      return queuedTime({ estimate });
    case 'running': {
      const time = runningTime({ activeMs, estimate, unknownBasis });
      return quietMs !== null && quietMs >= QUIET_TURN_AFTER_MS
        ? quietTime({ time, quietMs })
        : time;
    }
    case 'waiting':
      return hasStarted ? pausedTime({ activeMs, estimate }) : queuedTime({ estimate });
    case 'failed':
      return hasStarted ? pausedTime({ activeMs, estimate: null }) : null;
    case 'done':
      return hasStarted ? doneTime({ activeMs, estimate }) : null;
    case 'closed':
      return hasStarted ? doneTime({ activeMs, estimate: null }) : null;
    case 'skipped':
      return null;
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};
