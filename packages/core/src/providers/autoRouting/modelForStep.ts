import type {
  CatalogModel,
  ModelCostTier,
  ModelDescriptor,
  ModelSelection,
  ProviderId,
  StepSize,
} from '@goodboy/types';
import { MODEL_CATALOGS } from '../catalogs';
import { cliGate } from '../cliGate';
import { MODEL_COST_RANK } from '../modelCostRank';
import { isModelHidden } from '../modelVisibility';
import { resolvedStoredModelId } from '../resolvedStoredModelId';
import { strongestModelForTier } from '../strongestModelForTier';
import type { PassedOver } from '../resolve/types';
import type { AutoChoice } from './autoJob';
import type { AutoContext, AutoPick, AutoSlot, AutoStep } from './autoTypes';
import { AUTO_RUNG_CHOICES, isCuratedProvider } from './defaults';
import { RUNGS, rungsNear, type Rung } from './effortLadder';
import { policyDefaultProvider, providerCandidates } from './providerCandidates';
import { lowestRungOf, rungForStep } from './slotRungs';

export type StepPick = AutoPick & {
  readonly rung: Rung;
};

type Params = AutoContext & {
  readonly slot: AutoSlot;
  readonly size?: StepSize | null;
};

const THINKING_ROLES: ReadonlySet<string> = new Set(['planner', 'investigator', 'custom']);

type ChoiceParams = {
  readonly provider: ProviderId;
  readonly choice: AutoChoice;
};

const selectionOf = ({ choice }: Pick<ChoiceParams, 'choice'>): ModelSelection => ({
  key: choice.key,
  ...(choice.effort != null && { effort: choice.effort }),
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
      combo.thinking === false && (choice.effort == null || combo.effort === choice.effort),
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

const isChoiceHidden = ({ provider, choice, context }: GateParams): boolean =>
  context.hidden != null && isModelHidden({ provider, hidden: context.hidden, key: choice.key });

const costRankOf = ({ provider, choice }: ChoiceParams): number => {
  const tier = catalogModelOf({ provider, choice })?.presentation.costTier ?? 'mid';
  return MODEL_COST_RANK[tier];
};

type TierParams = {
  readonly rung: Rung;
};

const rungTier = ({ rung }: TierParams): ModelCostTier => {
  const reference = AUTO_RUNG_CHOICES.anthropic[rung][0];
  const model = MODEL_CATALOGS.anthropic.find((candidate) => candidate.key === reference?.key);
  return model?.presentation.costTier ?? 'mid';
};

type StepParams = {
  readonly provider: ProviderId;
  readonly index: number;
  readonly context: AutoContext;
};

const stepOf = ({ provider, index, context }: StepParams): AutoStep => {
  if (provider !== policyDefaultProvider(context)) {
    return 'next-provider';
  }
  return index === 0 ? 'curated' : 'next-in-column';
};

type ProviderPickParams = {
  readonly provider: ProviderId;
  readonly slot: AutoSlot;
  readonly rung: Rung;
  readonly context: AutoContext;
};

type IndexedChoice = {
  readonly choice: AutoChoice;
  readonly index: number;
};

type RungParams = {
  readonly provider: ProviderId;
  readonly rung: Rung;
};

const rungChoices = ({ provider, rung }: RungParams): ReadonlyArray<AutoChoice> =>
  isCuratedProvider(provider) ? AUTO_RUNG_CHOICES[provider][rung] : [];

const usableChoices = ({
  provider,
  rung,
  context,
}: Omit<ProviderPickParams, 'slot'>): ReadonlyArray<IndexedChoice> =>
  rungChoices({ provider, rung })
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => isChoiceUsable({ provider, choice, context }));

type VisibleTaskParams = {
  readonly provider: ProviderId;
  readonly usable: ReadonlyArray<IndexedChoice>;
  readonly context: AutoContext;
};

const visibleTaskChoice = ({
  provider,
  usable,
  context,
}: VisibleTaskParams): IndexedChoice | null => {
  const first = usable[0];
  if (first == null) {
    return null;
  }
  const ceiling = costRankOf({ provider, choice: first.choice });
  return (
    usable.find(
      ({ choice }) =>
        !isChoiceHidden({ provider, choice, context }) &&
        costRankOf({ provider, choice }) <= ceiling,
    ) ?? null
  );
};

type PickOfParams = {
  readonly provider: ProviderId;
  readonly picked: IndexedChoice;
  readonly rung: Rung;
  readonly context: AutoContext;
};

const pickOf = ({ provider, picked, rung, context }: PickOfParams): StepPick => ({
  provider,
  model: resolvedStoredModelId({ provider, selection: selectionOf({ choice: picked.choice }) }),
  effort: picked.choice.effort ?? null,
  step: stepOf({ provider, index: picked.index, context }),
  rung,
});

const curatedPick = ({ provider, slot, rung, context }: ProviderPickParams): StepPick | null => {
  const usable = usableChoices({ provider, rung, context });
  if (slot.kind === 'task') {
    const visible = visibleTaskChoice({ provider, usable, context });
    return visible == null ? null : pickOf({ provider, picked: visible, rung, context });
  }
  const picked = usable.find(({ choice }) => !isChoiceHidden({ provider, choice, context }));
  return picked == null ? null : pickOf({ provider, picked, rung, context });
};

type NearParams = ProviderPickParams & {
  readonly isHeavy: boolean;
};

const nearRungPick = ({ provider, slot, rung, context, isHeavy }: NearParams): StepPick | null => {
  if (!isCuratedProvider(provider)) {
    return null;
  }
  const lowest = lowestRungOf({ slot });
  for (const near of rungsNear({ rung, isHeavy })) {
    if (RUNGS.indexOf(near) < RUNGS.indexOf(lowest)) {
      continue;
    }
    const picked = curatedPick({ provider, slot, rung: near, context });
    if (picked != null) {
      const step = provider === policyDefaultProvider(context) ? 'next-in-column' : 'next-provider';
      return { ...picked, step };
    }
  }
  return null;
};

const tierPick = ({ provider, slot, rung, context }: ProviderPickParams): StepPick | null => {
  const model = strongestModelForTier({
    provider,
    tier: rungTier({ rung }),
    wantsThinker: slot.kind === 'role' && THINKING_ROLES.has(slot.id),
    ...(context.hidden != null && { hidden: context.hidden }),
  });
  if (model == null) {
    return null;
  }
  return { provider, model: model.id, effort: null, step: 'cost-tier', rung };
};

type SkippedParams = {
  readonly pick: StepPick;
  readonly context: AutoContext;
};

const skippedAtLimitBefore = ({ pick, context }: SkippedParams): ReadonlyArray<ProviderId> => {
  const atLimit = context.atLimit ?? [];
  if (atLimit.length === 0) {
    return [];
  }
  const ladder = providerCandidates({ ...context, atLimit: null });
  const index = ladder.indexOf(pick.provider);
  return ladder
    .slice(0, index === -1 ? ladder.length : index)
    .filter((provider) => atLimit.includes(provider));
};

type TierUsableParams = {
  readonly provider: ProviderId;
  readonly model: ModelDescriptor;
  readonly context: AutoContext;
};

const isTierModelUsable = ({ provider, model, context }: TierUsableParams): boolean => {
  const catalogModel = catalogModelOf({ provider, choice: { key: model.id } });
  if (
    catalogModel != null &&
    catalogModel.provider === 'cursor' &&
    context.isCursorMaxModeOn !== true &&
    catalogModel.combos.every((combo) => combo.maxMode)
  ) {
    return false;
  }
  return (
    cliGate({
      provider,
      modelKey: model.id,
      installedVersion: context.cliVersions?.[provider] ?? null,
      learned: context.learned ?? [],
    }) === null
  );
};

type HiddenTierParams = ProviderPickParams & {
  readonly isCeilingKept: boolean;
};

const hiddenTierPick = ({
  provider,
  slot,
  rung,
  context,
  isCeilingKept,
}: HiddenTierParams): StepPick | null => {
  const first = usableChoices({ provider, rung, context })[0];
  if (context.hidden == null || first == null) {
    return null;
  }
  const model = strongestModelForTier({
    provider,
    tier: rungTier({ rung }),
    wantsThinker: slot.kind === 'role' && THINKING_ROLES.has(slot.id),
    hidden: context.hidden,
    isUsable: (candidate) => isTierModelUsable({ provider, model: candidate, context }),
  });
  if (model == null) {
    return null;
  }
  if (
    slot.kind === 'task' &&
    isCeilingKept &&
    MODEL_COST_RANK[model.costTier] > costRankOf({ provider, choice: first.choice })
  ) {
    return null;
  }
  return { provider, model: model.id, effort: null, step: 'cost-tier', rung };
};

type PassParams = {
  readonly slot: AutoSlot;
  readonly size: StepSize | null;
  readonly context: AutoContext;
  readonly isCeilingKept: boolean;
};

const resolvePass = ({ slot, size, context, isCeilingKept }: PassParams): StepPick | null => {
  const rung = rungForStep({ slot: slot.id, size });
  const isHeavy = size === 'large';
  for (const provider of providerCandidates(context)) {
    const pick = isCuratedProvider(provider)
      ? (curatedPick({ provider, slot, rung, context }) ??
        nearRungPick({ provider, slot, rung, context, isHeavy }) ??
        hiddenTierPick({ provider, slot, rung, context, isCeilingKept }))
      : tierPick({ provider, slot, rung, context });
    if (pick != null) {
      const skippedAtLimit = skippedAtLimitBefore({ pick, context });
      return skippedAtLimit.length === 0 ? pick : { ...pick, skippedAtLimit };
    }
  }
  return null;
};

export const modelForStep = ({ slot, size = null, ...context }: Params): StepPick | null =>
  resolvePass({ slot, size, context, isCeilingKept: true }) ??
  (slot.kind === 'task' ? resolvePass({ slot, size, context, isCeilingKept: false }) : null);

type PassedOverParams = {
  readonly slot: AutoSlot;
  readonly size?: StepSize | null;
  readonly pick: AutoPick;
  readonly context: AutoContext;
};

export const autoPassedOver = ({
  slot,
  size = null,
  pick,
  context,
}: PassedOverParams): ReadonlyArray<PassedOver> => {
  const { provider } = pick;
  if (!isCuratedProvider(provider)) {
    return [];
  }
  const choices = AUTO_RUNG_CHOICES[provider][rungForStep({ slot: slot.id, size })];
  const at = choices.findIndex(
    (choice) =>
      resolvedStoredModelId({ provider, selection: selectionOf({ choice }) }) === pick.model,
  );
  return choices.slice(0, Math.max(at, 0)).flatMap((choice): PassedOver[] => {
    const model = resolvedStoredModelId({ provider, selection: selectionOf({ choice }) });
    if (catalogModelOf({ provider, choice }) == null) {
      return [{ model, reason: 'unknown-model' }];
    }
    const isTooOld =
      cliGate({
        provider,
        modelKey: choice.key,
        installedVersion: context.cliVersions?.[provider] ?? null,
        learned: context.learned ?? [],
      }) !== null;
    if (isTooOld) {
      return [{ model, reason: 'cli-too-old' }];
    }
    return isChoiceHidden({ provider, choice, context }) ? [{ model, reason: 'hidden' }] : [];
  });
};
