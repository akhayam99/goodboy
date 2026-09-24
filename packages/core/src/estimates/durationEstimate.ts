import type { AgentRole } from '@goodboy/types';

export type RunDurationSample = {
  readonly activeMs: number;
  readonly costUsd: number | null;
  readonly endedAtMs: number;
};

export type DurationSample = RunDurationSample & {
  readonly role: AgentRole;
  readonly provider: string;
  readonly model: string;
  readonly effort: string | null;
};

export type EstimateKey = {
  readonly role: AgentRole;
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
};

export type EstimateTier = 'exact' | 'model' | 'provider' | 'role' | 'runs';

export type CostRange = {
  readonly p25Usd: number;
  readonly p75Usd: number;
};

export type DurationEstimate = {
  readonly tier: EstimateTier;
  readonly sampleCount: number;
  readonly p25Ms: number;
  readonly p50Ms: number;
  readonly p75Ms: number;
  readonly cost: CostRange | null;
};

export type EstimateTotal = {
  readonly p25Ms: number;
  readonly p75Ms: number;
  readonly cost: CostRange | null;
};

export const ESTIMATE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

const ESTIMATE_MAX_SAMPLES = 50;

const ESTIMATE_MIN_SAMPLES: Record<EstimateTier, number> = {
  exact: 5,
  model: 5,
  provider: 8,
  role: 8,
  runs: 5,
};

type QuantileParams = {
  readonly sorted: ReadonlyArray<number>;
  readonly q: number;
};

const quantile = ({ sorted, q }: QuantileParams): number => {
  if (sorted.length === 0) {
    return 0;
  }
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
};

type ValuesParams = {
  readonly values: ReadonlyArray<number>;
};

const winsorized = ({ values }: ValuesParams): ReadonlyArray<number> => {
  const sorted = [...values].sort((left, right) => left - right);
  const cap = quantile({ sorted, q: 0.95 });
  return sorted.map((value) => Math.min(value, cap));
};

type TierParams = {
  readonly samples: ReadonlyArray<RunDurationSample>;
  readonly tier: EstimateTier;
};

const estimateFrom = ({ samples, tier }: TierParams): DurationEstimate | null => {
  const minimum = ESTIMATE_MIN_SAMPLES[tier];
  if (samples.length < minimum) {
    return null;
  }
  const recent = [...samples]
    .sort((left, right) => right.endedAtMs - left.endedAtMs)
    .slice(0, ESTIMATE_MAX_SAMPLES);
  const durations = winsorized({ values: recent.map((sample) => sample.activeMs) });
  const costs = recent.flatMap((sample) => (sample.costUsd === null ? [] : [sample.costUsd]));
  const costSorted = costs.length >= minimum ? winsorized({ values: costs }) : null;
  return {
    tier,
    sampleCount: recent.length,
    p25Ms: quantile({ sorted: durations, q: 0.25 }),
    p50Ms: quantile({ sorted: durations, q: 0.5 }),
    p75Ms: quantile({ sorted: durations, q: 0.75 }),
    cost:
      costSorted === null
        ? null
        : {
            p25Usd: quantile({ sorted: costSorted, q: 0.25 }),
            p75Usd: quantile({ sorted: costSorted, q: 0.75 }),
          },
  };
};

type WindowParams<T extends RunDurationSample> = {
  readonly samples: ReadonlyArray<T>;
  readonly nowMs: number;
};

const inWindow = <T extends RunDurationSample>({ samples, nowMs }: WindowParams<T>) =>
  samples.filter((sample) => sample.endedAtMs >= nowMs - ESTIMATE_WINDOW_MS);

type KeyTier = {
  readonly tier: Exclude<EstimateTier, 'runs'>;
  readonly matches: (sample: DurationSample) => boolean;
};

const keyTiers = ({ key }: { readonly key: EstimateKey }): ReadonlyArray<KeyTier> => {
  const sameRole = (sample: DurationSample) => sample.role === key.role;
  const sameProvider = (sample: DurationSample) =>
    sameRole(sample) && sample.provider === key.provider;
  const sameModel = (sample: DurationSample) => sameProvider(sample) && sample.model === key.model;
  const tiers: Array<KeyTier> = [];
  if (key.provider !== null && key.model !== null) {
    tiers.push({
      tier: 'exact',
      matches: (sample) => sameModel(sample) && sample.effort === key.effort,
    });
    tiers.push({ tier: 'model', matches: sameModel });
  }
  if (key.provider !== null) {
    tiers.push({ tier: 'provider', matches: sameProvider });
  }
  tiers.push({ tier: 'role', matches: sameRole });
  return tiers;
};

type EstimateParams = {
  readonly samples: ReadonlyArray<DurationSample>;
  readonly key: EstimateKey;
  readonly nowMs: number;
};

export const estimateDuration = ({ samples, key, nowMs }: EstimateParams) => {
  const recent = inWindow({ samples, nowMs });
  for (const { tier, matches } of keyTiers({ key })) {
    const estimate = estimateFrom({ samples: recent.filter(matches), tier });
    if (estimate !== null) {
      return estimate;
    }
  }
  return null;
};

type RunEstimateParams = {
  readonly runs: ReadonlyArray<RunDurationSample>;
  readonly nowMs: number;
};

export const estimateOrchestratedRun = ({ runs, nowMs }: RunEstimateParams) =>
  estimateFrom({ samples: inWindow({ samples: runs, nowMs }), tier: 'runs' });

type SumParams = {
  readonly estimates: ReadonlyArray<DurationEstimate | null>;
};

export const sumEstimates = ({ estimates }: SumParams): EstimateTotal | null => {
  if (estimates.length === 0) {
    return null;
  }
  const known = estimates.flatMap((estimate) => (estimate === null ? [] : [estimate]));
  if (known.length !== estimates.length) {
    return null;
  }
  const costs = known.flatMap((estimate) => (estimate.cost === null ? [] : [estimate.cost]));
  return {
    p25Ms: known.reduce((total, estimate) => total + estimate.p25Ms, 0),
    p75Ms: known.reduce((total, estimate) => total + estimate.p75Ms, 0),
    cost:
      costs.length === known.length
        ? {
            p25Usd: costs.reduce((total, cost) => total + cost.p25Usd, 0),
            p75Usd: costs.reduce((total, cost) => total + cost.p75Usd, 0),
          }
        : null,
  };
};
