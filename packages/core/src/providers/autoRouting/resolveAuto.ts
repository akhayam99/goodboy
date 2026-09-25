import type {
  AgentRole,
  AuxTaskId,
  CatalogModel,
  EffortLevel,
  ModelCostTier,
  ModelSelection,
  ProviderId,
} from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '../capabilities';
import { MODEL_CATALOGS } from '../catalogs';
import { cliGate, type CliRequirement } from '../cliGate';
import { resolvedStoredModelId } from '../resolvedStoredModelId';
import { strongestModelForTier } from '../strongestModelForTier';
import { AUTO_DEFAULTS, isCuratedProvider, type AutoChoice } from './defaults';

export type AutoSlot =
  | { readonly kind: 'role'; readonly id: AgentRole }
  | { readonly kind: 'task'; readonly id: AuxTaskId };

export type AutoContext = {
  readonly defaultProvider: ProviderId;
  readonly fallbackOrder?: ReadonlyArray<ProviderId> | null;
  readonly connected?: ReadonlyArray<ProviderId> | null;
  readonly cliVersions?: Partial<Record<ProviderId, string | null>>;
  readonly learned?: ReadonlyArray<CliRequirement>;
  readonly isCursorMaxModeOn?: boolean;
};

export type AutoStep = 'curated' | 'next-in-column' | 'next-provider' | 'cost-tier';

export type AutoPick = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly step: AutoStep;
};

type Params = AutoContext & {
  readonly slot: AutoSlot;
};

type ProviderGateParams = {
  readonly provider: ProviderId;
  readonly context: AutoContext;
};

type ProviderGate = (params: ProviderGateParams) => boolean;

const isConnected: ProviderGate = ({ provider, context }) =>
  context.connected == null || context.connected.includes(provider);

export const AUTO_PROVIDER_GATES: ReadonlyArray<ProviderGate> = [isConnected];

const ALL_PROVIDERS: ReadonlyArray<ProviderId> = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

const THINKING_ROLES: ReadonlySet<string> = new Set(['planner', 'investigator', 'custom']);

const candidateProviders = (context: AutoContext): ReadonlyArray<ProviderId> => {
  const order = context.fallbackOrder ?? ALL_PROVIDERS;
  const unique = [...new Set([context.defaultProvider, ...order])];
  const usable = unique.filter((provider) =>
    AUTO_PROVIDER_GATES.every((gate) => gate({ provider, context })),
  );
  const curatedFirst = usable.filter(
    (provider) => provider === context.defaultProvider || isCuratedProvider(provider),
  );
  const rest = usable.filter((provider) => !curatedFirst.includes(provider));
  return [...curatedFirst, ...rest];
};

type ChoiceParams = {
  readonly provider: ProviderId;
  readonly choice: AutoChoice;
};

const selectionOf = ({ choice }: Pick<ChoiceParams, 'choice'>): ModelSelection => ({
  key: choice.key,
  ...(choice.effort != null && { effort: choice.effort }),
  ...(choice.thinking === true && { toggles: { thinking: true } }),
});

const catalogModelOf = ({ provider, choice }: ChoiceParams): CatalogModel | null => {
  const catalog: ReadonlyArray<CatalogModel> = MODEL_CATALOGS[provider];
  return catalog.find((candidate) => candidate.key === choice.key) ?? null;
};

type GateParams = ChoiceParams & {
  readonly context: AutoContext;
};

const needsMaxMode = ({ provider, choice, context }: GateParams): boolean => {
  const model = catalogModelOf({ provider, choice });
  if (model == null || model.provider !== 'cursor' || context.isCursorMaxModeOn === true) {
    return false;
  }
  const matching = model.combos.filter(
    (combo) =>
      combo.thinking === (choice.thinking === true) &&
      (choice.effort == null || combo.effort === choice.effort),
  );
  return matching.length > 0 && matching.every((combo) => combo.maxMode);
};

const isChoiceUsable = ({ provider, choice, context }: GateParams): boolean => {
  if (catalogModelOf({ provider, choice }) == null) {
    return false;
  }
  if (needsMaxMode({ provider, choice, context })) {
    return false;
  }
  return (
    cliGate({
      provider,
      modelKey: choice.key,
      installedVersion: context.cliVersions?.[provider] ?? null,
      learned: context.learned ?? [],
    }) === null
  );
};

const slotTier = (slot: AutoSlot): ModelCostTier => {
  const reference = AUTO_DEFAULTS.anthropic[slot.id][0];
  const model = MODEL_CATALOGS.anthropic.find((candidate) => candidate.key === reference?.key);
  return model?.presentation.costTier ?? 'mid';
};

type StepParams = {
  readonly provider: ProviderId;
  readonly index: number;
  readonly context: AutoContext;
};

const stepOf = ({ provider, index, context }: StepParams): AutoStep => {
  if (provider !== context.defaultProvider) {
    return 'next-provider';
  }
  return index === 0 ? 'curated' : 'next-in-column';
};

type ProviderPickParams = {
  readonly provider: ProviderId;
  readonly slot: AutoSlot;
  readonly context: AutoContext;
};

const curatedPick = ({ provider, slot, context }: ProviderPickParams): AutoPick | null => {
  if (!isCuratedProvider(provider)) {
    return null;
  }
  const column = AUTO_DEFAULTS[provider][slot.id];
  const index = column.findIndex((choice) => isChoiceUsable({ provider, choice, context }));
  const choice = column[index];
  if (choice == null) {
    return null;
  }
  return {
    provider,
    model: resolvedStoredModelId({ provider, selection: selectionOf({ choice }) }),
    effort: choice.effort ?? null,
    step: stepOf({ provider, index, context }),
  };
};

const tierPick = ({ provider, slot }: ProviderPickParams): AutoPick | null => {
  const model = strongestModelForTier({
    provider,
    tier: slotTier(slot),
    wantsThinker: slot.kind === 'role' && THINKING_ROLES.has(slot.id),
  });
  if (model == null) {
    return null;
  }
  return { provider, model: model.id, effort: null, step: 'cost-tier' };
};

export const resolveAuto = ({ slot, ...context }: Params): AutoPick | null => {
  for (const provider of candidateProviders(context)) {
    const pick = isCuratedProvider(provider)
      ? curatedPick({ provider, slot, context })
      : tierPick({ provider, slot, context });
    if (pick != null) {
      return pick;
    }
  }
  return null;
};
