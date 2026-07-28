import type { ModelCostTier, ProviderId, RoleModelPreferences } from '@goodboy/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel } from './capabilities';
import { resolveRoleRouting } from './role-models';

export type AutoModelChoice = {
  readonly provider: ProviderId;
  readonly model: string;
};

type AutoParams = {
  readonly role: string;
  readonly providers: ReadonlyArray<ProviderId>;
  readonly prefs?: RoleModelPreferences | null;
};

type Params = {
  readonly role: string;
  readonly provider: ProviderId;
  readonly prefs?: RoleModelPreferences | null;
};

const COST_RANK: Readonly<Record<ModelCostTier, number>> = {
  cheap: 1,
  mid: 2,
  expensive: 3,
};

export const autoModelForRole = ({
  role,
  providers,
  prefs,
}: AutoParams): AutoModelChoice | null => {
  if (providers.length === 0) {
    return null;
  }

  const def = resolveRoleRouting({ role, prefs });
  if (providers.includes(def.provider)) {
    return { provider: def.provider, model: def.model };
  }

  const tier = PROVIDER_CAPABILITIES[def.provider].models.find((m) => m.id === def.model)?.costTier;
  const target = COST_RANK[tier ?? 'mid'];
  let best: { provider: ProviderId; model: string; score: number } | null = null;
  for (const provider of providers) {
    for (const m of PROVIDER_CAPABILITIES[provider].models) {
      const score = -Math.abs(COST_RANK[m.costTier] - target) * 1000 + m.weight;
      if (best === null || score > best.score) {
        best = { provider, model: m.id, score };
      }
    }
  }
  if (best === null) {
    return null;
  }
  return { provider: best.provider, model: best.model };
};

export const recommendedModelForRole = ({ role, provider, prefs }: Params): string => {
  return (
    autoModelForRole({ role, providers: [provider], prefs })?.model ??
    getDefaultTurnModel({ id: provider })
  );
};
