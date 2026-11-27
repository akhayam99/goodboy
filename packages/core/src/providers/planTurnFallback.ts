import type { ModelCostTier, ModelDescriptor, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { outdatedCliModels, type CliRequirement } from './cliGate';
import { taskModelProviderPool } from './providerFallbackPool';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';
import { isModelHidden, type HiddenModels } from './modelVisibility';
import { strongestModelForTier } from './strongestModelForTier';

export type TurnFailureKind =
  | 'authentication'
  | 'rate_limit'
  | 'usage_limit'
  | 'model_not_available'
  | 'cli_too_old'
  | 'unreachable'
  | 'other';

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
  readonly hidden?: HiddenModels | null;
  readonly cliVersions?: Partial<Record<ProviderId, string | null>> | null;
  readonly learned?: ReadonlyArray<CliRequirement> | null;
};

type PreferredParams = {
  readonly preferred: TurnFallbackPlan | undefined;
  readonly provider: ProviderId;
  readonly model: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly candidateProviders: ReadonlyArray<ProviderId>;
  readonly gated: HiddenModels;
};

type GatedParams = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly cliVersions: Partial<Record<ProviderId, string | null>>;
  readonly learned: ReadonlyArray<CliRequirement>;
};

type MergeParams = {
  readonly hidden: HiddenModels | null;
  readonly gated: HiddenModels;
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
  readonly hidden: HiddenModels | null;
};

type OtherProviderParams = {
  readonly provider: ProviderId;
  readonly candidateProviders: ReadonlyArray<ProviderId>;
  readonly tier: ModelCostTier;
  readonly wantsThinker: boolean;
  readonly hidden: HiddenModels | null;
};

type AlignedParams = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly candidateProviders: ReadonlyArray<ProviderId>;
  readonly wantsThinker: boolean;
  readonly hidden?: HiddenModels | null;
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
  hidden,
}: ClosestParams): string | null => {
  const target = tierIndex({ tier });
  const candidates = PROVIDER_CAPABILITIES[provider].models.filter((candidate) => {
    if (excludeModel != null && candidate.id === excludeModel) {
      return false;
    }
    if (candidate.thinkerOnly && !wantsThinker) {
      return false;
    }
    if (hidden != null && isModelHidden({ provider, hidden, key: candidate.id })) {
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
  hidden,
}: OtherProviderParams): TurnFallbackPlan | null => {
  for (const target of candidateProviders) {
    if (target === provider) {
      continue;
    }
    const model = strongestModelForTier({
      provider: target,
      tier,
      wantsThinker,
      ...(hidden != null && { hidden }),
    });
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
  hidden,
}: AlignedParams): TurnFallbackPlan | null => {
  const failed = descriptorFor({ provider, model });
  return otherProviderPlan({
    provider,
    candidateProviders,
    tier: failed?.costTier ?? 'mid',
    wantsThinker,
    hidden: hidden ?? null,
  });
};

const cliGatedModels = ({ providers, cliVersions, learned }: GatedParams): HiddenModels =>
  Object.fromEntries(
    providers.flatMap((target) => {
      const keys = outdatedCliModels({
        provider: target,
        installedVersion: cliVersions[target] ?? null,
        learned,
      }).map((gate) => gate.model.key);
      return keys.length === 0 ? [] : [[target, keys]];
    }),
  );

const mergeHidden = ({ hidden, gated }: MergeParams): HiddenModels | null => {
  const gatedProviders = Object.keys(gated).filter(
    (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
  );
  if (gatedProviders.length === 0) {
    return hidden;
  }
  const merged: Partial<Record<ProviderId, ReadonlyArray<string>>> = { ...hidden };
  for (const target of gatedProviders) {
    merged[target] = [...(hidden?.[target] ?? []), ...(gated[target] ?? [])];
  }
  return merged;
};

const preferredPlan = ({
  preferred,
  provider,
  model,
  connectedProviders,
  candidateProviders,
  gated,
}: PreferredParams): TurnFallbackPlan | null => {
  if (preferred == null) {
    return null;
  }
  const isSameProvider = preferred.provider === provider;
  if (
    isSameProvider &&
    descriptorKey({ provider, model: preferred.model }) === descriptorKey({ provider, model })
  ) {
    return null;
  }
  if (isSameProvider && !connectedProviders.includes(preferred.provider)) {
    return null;
  }
  if (!isSameProvider && !candidateProviders.includes(preferred.provider)) {
    return null;
  }
  if (descriptorFor({ provider: preferred.provider, model: preferred.model }) == null) {
    return null;
  }
  if (
    isModelHidden({
      provider: preferred.provider,
      hidden: gated,
      key: descriptorKey({ provider: preferred.provider, model: preferred.model }),
    })
  ) {
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
  hidden: hiddenModels,
  cliVersions,
  learned,
}: Params): TurnFallbackPlan | null => {
  if (attempt >= MAX_ATTEMPTS || failure === 'other') {
    return null;
  }
  const candidateProviders = taskModelProviderPool({
    provider,
    connectedProviders,
    enabledProviders: enabledProviders ?? null,
    coolingDownProviders: coolingDownProviders ?? [],
  });
  const gated = cliGatedModels({
    providers: [provider, ...candidateProviders.filter((target) => target !== provider)],
    cliVersions: cliVersions ?? {},
    learned: learned ?? [],
  });
  if (attempt === 0) {
    const picked = preferredPlan({
      preferred,
      provider,
      model,
      connectedProviders,
      candidateProviders,
      gated,
    });
    if (picked != null && (failure !== 'usage_limit' || picked.provider !== provider)) {
      return picked;
    }
  }
  const hidden = mergeHidden({ hidden: hiddenModels ?? null, gated });
  const failed = descriptorFor({ provider, model });
  const failedKey = descriptorKey({ provider, model });
  const tier = failed?.costTier ?? 'mid';
  const weight = failed?.weight ?? null;
  if (failure === 'usage_limit') {
    return otherProviderPlan({ provider, candidateProviders, tier, wantsThinker, hidden });
  }
  if (failure === 'authentication') {
    return otherProviderPlan({ provider, candidateProviders, tier, wantsThinker, hidden });
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
      hidden,
    });
    if (cheaper != null) {
      return { provider, model: cheaper };
    }
  }
  if ((failure === 'model_not_available' || failure === 'cli_too_old') && attempt === 0) {
    const sibling = pickClosest({
      provider,
      tier,
      weight,
      wantsThinker,
      excludeModel: failedKey,
      maxTierIndex: null,
      hidden,
    });
    if (sibling != null) {
      return { provider, model: sibling };
    }
  }
  return otherProviderPlan({ provider, candidateProviders, tier, wantsThinker, hidden });
};
