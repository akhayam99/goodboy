import type { ModelCostTier, ModelDescriptor, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { taskModelProviderPool } from './providerFallbackPool';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';
import { strongestModelForTier } from './strongestModelForTier';

export type TurnFailureKind =
  'authentication' | 'rate_limit' | 'usage_limit' | 'model_not_available' | 'unreachable' | 'other';

export type TurnFallbackPlan = {
  readonly provider: ProviderId;
  readonly model: string;
};

type Params = {
  readonly failure: TurnFailureKind;
  readonly provider: ProviderId;
  readonly model: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly attempt: number;
  readonly wantsThinker: boolean;
  readonly enabledProviders?: ReadonlyArray<ProviderId> | null;
  readonly coolingDownProviders?: ReadonlyArray<ProviderId>;
  readonly preferred?: TurnFallbackPlan;
};

type PreferredParams = {
  readonly preferred: TurnFallbackPlan | undefined;
  readonly provider: ProviderId;
  readonly model: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
};

type TierParams = {
  readonly tier: ModelCostTier;
};

type DescriptorParams = {
  readonly provider: ProviderId;
  readonly model: string;
};

type ClosestParams = {
  readonly provider: ProviderId;
  readonly tier: ModelCostTier;
  readonly weight: number | null;
  readonly wantsThinker: boolean;
  readonly excludeModel: string | null;
  readonly maxTierIndex: number | null;
};

type OtherProviderParams = {
  readonly provider: ProviderId;
  readonly candidateProviders: ReadonlyArray<ProviderId>;
  readonly tier: ModelCostTier;
  readonly wantsThinker: boolean;
};

type AlignedParams = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly candidateProviders: ReadonlyArray<ProviderId>;
  readonly wantsThinker: boolean;
};

const MAX_ATTEMPTS = 2;

const COST_TIER_ORDER: ReadonlyArray<ModelCostTier> = ['cheap', 'mid', 'expensive'];

const tierIndex = ({ tier }: TierParams): number => {
  return COST_TIER_ORDER.indexOf(tier);
};

const descriptorKey = ({ provider, model }: DescriptorParams): string => {
  const stored = resolveStoredModelSelection({ provider, id: model });
  return stored.report?.kind === 'unknown' ? model : stored.selection.key;
};

const descriptorFor = ({ provider, model }: DescriptorParams): ModelDescriptor | null => {
  const key = descriptorKey({ provider, model });
  return PROVIDER_CAPABILITIES[provider].models.find((candidate) => candidate.id === key) ?? null;
};

const pickClosest = ({
  provider,
  tier,
  weight,
  wantsThinker,
  excludeModel,
  maxTierIndex,
}: ClosestParams): string | null => {
  const target = tierIndex({ tier });
  const candidates = PROVIDER_CAPABILITIES[provider].models.filter((candidate) => {
    if (excludeModel != null && candidate.id === excludeModel) {
      return false;
    }
    if (candidate.thinkerOnly && !wantsThinker) {
      return false;
    }
    if (maxTierIndex == null) {
      return true;
    }
    return tierIndex({ tier: candidate.costTier }) <= maxTierIndex;
  });
  const ranked = [...candidates].sort((a, b) => {
    const tierGap =
      Math.abs(tierIndex({ tier: a.costTier }) - target) -
      Math.abs(tierIndex({ tier: b.costTier }) - target);
    if (tierGap !== 0) {
      return tierGap;
    }
    if (weight == null) {
      return b.weight - a.weight;
    }
    return Math.abs(a.weight - weight) - Math.abs(b.weight - weight);
  });
  return ranked[0]?.id ?? null;
};

const otherProviderPlan = ({
  provider,
  candidateProviders,
  tier,
  wantsThinker,
}: OtherProviderParams): TurnFallbackPlan | null => {
  for (const target of candidateProviders) {
    if (target === provider) {
      continue;
    }
    const model = strongestModelForTier({ provider: target, tier, wantsThinker });
    if (model != null) {
      return { provider: target, model: model.id };
    }
  }
  return null;
};

export const alignedProviderPlan = ({
  provider,
  model,
  candidateProviders,
  wantsThinker,
}: AlignedParams): TurnFallbackPlan | null => {
  const failed = descriptorFor({ provider, model });
  return otherProviderPlan({
    provider,
    candidateProviders,
    tier: failed?.costTier ?? 'mid',
    wantsThinker,
  });
};

const preferredPlan = ({
  preferred,
  provider,
  model,
  connectedProviders,
}: PreferredParams): TurnFallbackPlan | null => {
  if (preferred == null) {
    return null;
  }
  if (
    preferred.provider === provider &&
    descriptorKey({ provider, model: preferred.model }) === descriptorKey({ provider, model })
  ) {
    return null;
  }
  if (!connectedProviders.includes(preferred.provider)) {
    return null;
  }
  if (descriptorFor({ provider: preferred.provider, model: preferred.model }) == null) {
    return null;
  }
  return { provider: preferred.provider, model: preferred.model };
};

export const planTurnFallback = ({
  failure,
  provider,
  model,
  connectedProviders,
  attempt,
  wantsThinker,
  enabledProviders,
  coolingDownProviders,
  preferred,
}: Params): TurnFallbackPlan | null => {
  if (attempt >= MAX_ATTEMPTS || failure === 'other') {
    return null;
  }
  if (attempt === 0) {
    const picked = preferredPlan({ preferred, provider, model, connectedProviders });
    if (picked != null && (failure !== 'usage_limit' || picked.provider !== provider)) {
      return picked;
    }
  }
  const failed = descriptorFor({ provider, model });
  const failedKey = descriptorKey({ provider, model });
  const tier = failed?.costTier ?? 'mid';
  const weight = failed?.weight ?? null;
  const candidateProviders = taskModelProviderPool({
    provider,
    connectedProviders,
    enabledProviders: enabledProviders ?? null,
    coolingDownProviders: coolingDownProviders ?? [],
  });
  if (failure === 'usage_limit') {
    return otherProviderPlan({ provider, candidateProviders, tier, wantsThinker });
  }
  if (failure === 'authentication') {
    return otherProviderPlan({ provider, candidateProviders, tier, wantsThinker });
  }
  if (failure === 'unreachable' && attempt === 0) {
    return { provider, model };
  }
  if (failure === 'rate_limit' && attempt === 0) {
    const cheaper = pickClosest({
      provider,
      tier,
      weight,
      wantsThinker,
      excludeModel: failedKey,
      maxTierIndex: Math.max(tierIndex({ tier }) - 1, 0),
    });
    if (cheaper != null) {
      return { provider, model: cheaper };
    }
  }
  if (failure === 'model_not_available' && attempt === 0) {
    const sibling = pickClosest({
      provider,
      tier,
      weight,
      wantsThinker,
      excludeModel: failedKey,
      maxTierIndex: null,
    });
    if (sibling != null) {
      return { provider, model: sibling };
    }
  }
  return otherProviderPlan({ provider, candidateProviders, tier, wantsThinker });
};
