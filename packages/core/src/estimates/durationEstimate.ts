import type { AgentRole, StepSize } from '@goodboy/types';

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
  readonly size?: StepSize | null;
};

export type DurationUnit = 'step' | 'turn';

export type DurationSamples = {
  readonly steps: ReadonlyArray<DurationSample>;
  readonly turns: ReadonlyArray<DurationSample>;
};

export type SampleHistory = DurationSamples & {
  readonly everyWorkspace: DurationSamples;
};

export type EstimateTier = 'exact' | 'model' | 'modelAnyWorkspace' | 'provider' | 'role' | 'runs';

export type CostRange = {
  readonly lowUsd: number;
  readonly highUsd: number;
};

export type DurationEstimate = {
  readonly tier: EstimateTier;
  readonly size: StepSize | null;
  readonly sampleCount: number;
  readonly lowMs: number;
  readonly midMs: number;
  readonly highMs: number;
  readonly cost: CostRange | null;
};

export type EstimateTotal = {
  readonly lowMs: number;
  readonly highMs: number;
  readonly cost: CostRange | null;
};

export const ESTIMATE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

const ESTIMATE_MAX_SAMPLES = 50;

const ESTIMATE_MIN_SAMPLES: Record<EstimateTier, number> = {
  exact: 5,
  model: 5,
  modelAnyWorkspace: 5,
  provider: 8,
  role: 8,
  runs: 5,
};

type Band = {
  readonly low: number;
  readonly mid: number;
  readonly high: number;
};

const UNSIZED_BAND: Band = { low: 0.25, mid: 0.5, high: 0.75 };

const SIZE_BANDS: Record<StepSize, Band> = {
  small: { low: 0.1, mid: 0.3, high: 0.5 },
  medium: UNSIZED_BAND,
  large: { low: 0.5, mid: 0.7, high: 0.9 },
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
  readonly size: StepSize | null;
};

const estimateFrom = ({ samples, tier, size }: TierParams): DurationEstimate | null => {
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
  const band = size === null ? UNSIZED_BAND : SIZE_BANDS[size];
  return {
    tier,
    size,
    sampleCount: recent.length,
    lowMs: quantile({ sorted: durations, q: band.low }),
    midMs: quantile({ sorted: durations, q: band.mid }),
    highMs: quantile({ sorted: durations, q: band.high }),
    cost:
      costSorted === null
        ? null
        : {
            lowUsd: quantile({ sorted: costSorted, q: band.low }),
            highUsd: quantile({ sorted: costSorted, q: band.high }),
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
  readonly isEveryWorkspace: boolean;
  readonly matches: (sample: DurationSample) => boolean;
};

const keyTiers = ({ key }: { readonly key: EstimateKey }): ReadonlyArray<KeyTier> => {
  const sameRole = (sample: DurationSample) => sample.role === key.role;
  const sameProvider = (sample: DurationSample) =>
    sameRole(sample) && sample.provider === key.provider;
  const sameModel = (sample: DurationSample) => sameProvider(sample) && sample.model === key.model;
  const sameRoute = (sample: DurationSample) => sameModel(sample) && sample.effort === key.effort;
  const tiers: Array<KeyTier> = [];
  if (key.provider !== null && key.model !== null) {
    tiers.push({ tier: 'exact', isEveryWorkspace: false, matches: sameRoute });
    tiers.push({ tier: 'model', isEveryWorkspace: false, matches: sameModel });
    tiers.push({ tier: 'modelAnyWorkspace', isEveryWorkspace: true, matches: sameRoute });
  }
  if (key.provider !== null) {
    tiers.push({ tier: 'provider', isEveryWorkspace: false, matches: sameProvider });
  }
  tiers.push({ tier: 'role', isEveryWorkspace: false, matches: sameRole });
  return tiers;
};

type UnitParams = {
  readonly samples: DurationSamples;
  readonly unit: DurationUnit;
};

const samplesOf = ({ samples, unit }: UnitParams): ReadonlyArray<DurationSample> =>
  unit === 'step' ? samples.steps : samples.turns;

type EstimateParams = {
  readonly history: SampleHistory;
  readonly unit: DurationUnit;
  readonly key: EstimateKey;
  readonly nowMs: number;
};

type TierPool = KeyTier & {
  readonly samples: ReadonlyArray<DurationSample>;
};

const tierPools = ({ history, unit, key, nowMs }: EstimateParams): ReadonlyArray<TierPool> => {
  const workspace = inWindow({ samples: samplesOf({ samples: history, unit }), nowMs });
  const everyWorkspace = inWindow({
    samples: samplesOf({ samples: history.everyWorkspace, unit }),
    nowMs,
  });
  return keyTiers({ key }).map((tier) => ({
    ...tier,
    samples: (tier.isEveryWorkspace ? everyWorkspace : workspace).filter(tier.matches),
  }));
};

export const estimateDuration = (params: EstimateParams) => {
  for (const { tier, samples } of tierPools(params)) {
    const estimate = estimateFrom({ samples, tier, size: params.key.size ?? null });
    if (estimate !== null) {
      return estimate;
    }
  }
  return null;
};

export type EstimateProgress = {
  readonly tier: Exclude<EstimateTier, 'runs'>;
  readonly have: number;
  readonly need: number;
};

export const estimateProgress = (params: EstimateParams): EstimateProgress | null => {
  let best: EstimateProgress | null = null;
  for (const { tier, samples } of tierPools(params)) {
    const need = ESTIMATE_MIN_SAMPLES[tier];
    const have = Math.min(samples.length, need);
    if (best === null || have / need > best.have / best.need) {
      best = { tier, have, need };
    }
  }
  return best;
};

type RunEstimateParams = {
  readonly runs: ReadonlyArray<RunDurationSample>;
  readonly nowMs: number;
};

export const estimateOrchestratedRun = ({ runs, nowMs }: RunEstimateParams) =>
  estimateFrom({ samples: inWindow({ samples: runs, nowMs }), tier: 'runs', size: null });

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
    lowMs: known.reduce((total, estimate) => total + estimate.lowMs, 0),
    highMs: known.reduce((total, estimate) => total + estimate.highMs, 0),
    cost:
      costs.length === known.length
        ? {
            lowUsd: costs.reduce((total, cost) => total + cost.lowUsd, 0),
            highUsd: costs.reduce((total, cost) => total + cost.highUsd, 0),
          }
        : null,
  };
};
