import type {
  AgentEffort,
  AgentRole,
  ModelCostTier,
  ProviderId,
  RoleModelChoice,
  RoleModelPreference,
  RoleModelPreferences,
  StepSize,
} from '@goodboy/types';
import { ROLE_MODEL_SET_MAX } from '@goodboy/types';
import { devWarn } from '../dev-log';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { catalogModelForId } from './catalogModelForId';
import { MODEL_COST_RANK } from './modelCostRank';
import { normalizeAgentRole } from '../roles';
import { resolveModelArgs } from './resolveModelArgs';
import { resolvedStoredModelId } from './resolvedStoredModelId';
import { resolveStoredModelSelection } from './resolveStoredModelSelection';
import { providerStanding } from './autoRouting/providerCandidates';
import { resolveAuto, type AutoContext, type AutoStep } from './autoRouting/resolveAuto';

export type PinnedUnavailable = Readonly<{
  provider: ProviderId;
  model: string;
}>;

export type ResolvedRoleRouting = Readonly<{
  provider: ProviderId;
  model: string;
  effort: AgentEffort;
  isOverride: boolean;
  autoStep?: AutoStep;
  pinnedUnavailable?: PinnedUnavailable;
}>;

export type ResolvedRoleChoice = Readonly<{
  provider: ProviderId;
  model: string;
  effort: AgentEffort;
}>;

type Params = {
  readonly role: string;
  readonly prefs: RoleModelPreferences | null | undefined;
  readonly auto?: AutoContext;
  readonly size?: StepSize | null;
};

const AUTO_ROLE_EFFORT: AgentEffort = 'medium';

const REFERENCE_CONTEXT: AutoContext = { defaultProvider: 'anthropic' };

const SIZE_COST_CAP: Readonly<Record<StepSize, number>> = {
  small: MODEL_COST_RANK.cheap,
  medium: MODEL_COST_RANK.mid,
  large: MODEL_COST_RANK.expensive,
};

const UNKNOWN_COST_TIER: ModelCostTier = 'mid';

type ChoicesParams = {
  readonly preference: RoleModelPreference;
};

export const roleModelChoices = ({ preference }: ChoicesParams): ReadonlyArray<RoleModelChoice> => {
  if (preference.models != null && preference.models.length > 0) {
    return preference.models.slice(0, ROLE_MODEL_SET_MAX);
  }
  const primary: RoleModelChoice = {
    providerId: preference.providerId,
    model: preference.model,
    effort: preference.effort,
  };
  if (preference.fallback == null) {
    return [primary];
  }
  return [
    primary,
    {
      providerId: preference.fallback.providerId,
      model: preference.fallback.model,
      effort: preference.fallback.effort ?? preference.effort,
    },
  ];
};

type SetPreferenceParams = {
  readonly choices: ReadonlyArray<RoleModelChoice>;
  readonly effort: AgentEffort;
};

export const roleModelSetPreference = ({
  choices,
  effort,
}: SetPreferenceParams): RoleModelPreference | null => {
  const kept = choices.slice(0, ROLE_MODEL_SET_MAX);
  const [first] = kept;
  if (first === undefined) {
    return null;
  }
  return {
    providerId: first.providerId,
    model: first.model,
    effort: first.effort ?? effort,
    models: kept,
  };
};

type ChoiceParams = {
  readonly choice: RoleModelChoice;
  readonly effort: AgentEffort;
};

export const resolveRoleChoice = ({ choice, effort }: ChoiceParams): ResolvedRoleChoice | null => {
  const capabilities = PROVIDER_CAPABILITIES[choice.providerId];
  if (capabilities == null) {
    return null;
  }
  const requested = choice.effort ?? effort;
  const stored = resolveStoredModelSelection({
    provider: choice.providerId,
    id: choice.model,
    effort: requested,
  });
  if (stored.report?.kind === 'unknown') {
    return null;
  }
  const resolved = resolveModelArgs({
    provider: choice.providerId,
    selection: stored.selection,
  });
  return {
    provider: choice.providerId,
    model: resolvedStoredModelId({
      provider: choice.providerId,
      selection: stored.selection,
    }),
    effort: resolved.clamped?.applied ?? requested,
  };
};

const costRank = ({ provider, model }: ResolvedRoleChoice): number =>
  MODEL_COST_RANK[
    catalogModelForId({ provider, modelId: model })?.presentation.costTier ?? UNKNOWN_COST_TIER
  ];

type BySizeParams = {
  readonly usable: ReadonlyArray<ResolvedRoleChoice>;
  readonly size: StepSize | null | undefined;
};

const choiceBySize = ({ usable, size }: BySizeParams): ResolvedRoleChoice | null => {
  const [first] = usable;
  if (first === undefined) {
    return null;
  }
  if (size == null) {
    return first;
  }
  const cap = SIZE_COST_CAP[size];
  const fitting = usable.find((choice) => costRank(choice) <= cap);
  if (fitting !== undefined) {
    return fitting;
  }
  return usable.reduce((cheapest, choice) =>
    costRank(choice) < costRank(cheapest) ? choice : cheapest,
  );
};

type AutoRoleParams = {
  readonly role: AgentRole;
  readonly auto: AutoContext;
};

const autoRoleRouting = ({ role, auto }: AutoRoleParams): ResolvedRoleRouting => {
  const pick =
    resolveAuto({ slot: { kind: 'role', id: role }, ...auto }) ??
    resolveAuto({ slot: { kind: 'role', id: role }, ...REFERENCE_CONTEXT });
  if (pick == null) {
    throw new Error(`no curated default for role ${role}`);
  }
  return {
    provider: pick.provider,
    model: pick.model,
    effort: pick.effort ?? AUTO_ROLE_EFFORT,
    isOverride: false,
    autoStep: pick.step,
  };
};

type UsableParams = {
  readonly provider: ProviderId;
  readonly auto: AutoContext | undefined;
};

const isUsable = ({ provider, auto }: UsableParams): boolean => {
  if (auto == null) {
    return true;
  }
  const standing = providerStanding({ provider, context: auto });
  return standing !== 'off' && standing !== 'not-connected';
};

type SetRoutingParams = {
  readonly role: string;
  readonly preference: RoleModelPreference;
  readonly compiled: ResolvedRoleRouting;
  readonly auto: AutoContext | undefined;
  readonly size: StepSize | null | undefined;
};

const setRoleRouting = ({
  role,
  preference,
  compiled,
  auto,
  size,
}: SetRoutingParams): ResolvedRoleRouting => {
  const choices = roleModelChoices({ preference });
  const known = choices.flatMap((choice) => {
    const resolved = resolveRoleChoice({ choice, effort: preference.effort });
    return resolved === null ? [] : [resolved];
  });
  const [first] = known;
  if (first === undefined) {
    const [stored] = choices;
    if (stored !== undefined) {
      devWarn(
        PROVIDER_CAPABILITIES[stored.providerId] == null
          ? `[role-models] invalid ${role} provider ${stored.providerId}; using the ${compiled.provider} default model`
          : `[role-models] invalid ${role} model ${stored.model} for ${stored.providerId}; using the ${compiled.provider} default model`,
      );
    }
    return compiled;
  }
  const usable = known.filter((choice) => isUsable({ provider: choice.provider, auto }));
  const picked = choiceBySize({ usable, size });
  const firstUsable = usable[0] === first;
  const pinnedUnavailable = firstUsable ? null : { provider: first.provider, model: first.model };
  if (picked === null) {
    return { ...compiled, ...(pinnedUnavailable !== null && { pinnedUnavailable }) };
  }
  return {
    ...picked,
    isOverride: true,
    ...(pinnedUnavailable !== null && { pinnedUnavailable }),
  };
};

export const resolveRoleRouting = ({ role, prefs, auto, size }: Params): ResolvedRoleRouting => {
  const normalizedRole = normalizeAgentRole({ role });
  const compiled = autoRoleRouting({ role: normalizedRole, auto: auto ?? REFERENCE_CONTEXT });
  const preference = prefs?.[normalizedRole];
  if (preference == null) {
    return compiled;
  }
  return setRoleRouting({ role, preference, compiled, auto, size });
};

type NextChoiceParams = {
  readonly role: string;
  readonly prefs: RoleModelPreferences | null | undefined;
  readonly failed: Readonly<{ provider: ProviderId; model: string }>;
};

export const nextRoleModelChoice = ({
  role,
  prefs,
  failed,
}: NextChoiceParams): ResolvedRoleChoice | null => {
  const preference = prefs?.[normalizeAgentRole({ role })];
  if (preference == null) {
    return null;
  }
  const known = roleModelChoices({ preference }).flatMap((choice) => {
    const resolved = resolveRoleChoice({ choice, effort: preference.effort });
    return resolved === null ? [] : [resolved];
  });
  const failedAt = known.findIndex(
    (choice) => choice.provider === failed.provider && choice.model === failed.model,
  );
  const backups = known.slice(failedAt < 0 ? 1 : failedAt + 1);
  return (
    backups.find(
      (choice) => choice.provider !== failed.provider || choice.model !== failed.model,
    ) ?? null
  );
};
