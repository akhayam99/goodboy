import type { CatalogModel, EffortLevel, ModelSelection, ProviderId } from '@goodboy/types';
import {
  MODEL_CATALOGS,
  getDefaultTurnModel,
  getModelProvider,
  resolveModelArgs,
  resolveStoredModelSelection,
} from '@goodboy/core';

export type Recommendation = {
  readonly provider?: ProviderId;
  readonly model?: string;
};

type Params = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: EffortLevel;
  readonly recommendation?: Recommendation;
};

export type ResolvedRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly selection: ModelSelection;
  readonly effort: EffortLevel;
  readonly effortLevels: ReadonlyArray<EffortLevel>;
  readonly clamped?: {
    readonly requested: EffortLevel;
    readonly applied: EffortLevel;
  };
  readonly isEffortFixed: boolean;
  readonly models: ReadonlyArray<string>;
  readonly catalog: ReadonlyArray<CatalogModel>;
  readonly hasThinkingToggle: boolean;
  readonly hasFastToggle: boolean;
  readonly isProviderRecommended: boolean;
  readonly isModelRecommended: boolean;
};

type EffortParams = {
  readonly model: CatalogModel;
  readonly selection: ModelSelection;
  readonly fallback: EffortLevel;
};

const effortsFor = ({ model, selection, fallback }: EffortParams): ReadonlyArray<EffortLevel> => {
  switch (model.provider) {
    case 'anthropic':
    case 'codex':
    case 'gemini':
    case 'opencode':
    case 'openrouter':
      return model.efforts;
    case 'cursor': {
      const thinking = selection.toggles?.thinking ?? model.combos[0]?.thinking ?? false;
      const fast = selection.toggles?.fast ?? model.combos[0]?.fast ?? false;
      const efforts = model.combos
        .filter((combo) => combo.thinking === thinking && combo.fast === fast)
        .map((combo) => combo.effort)
        .filter((effort) => effort != null);
      return efforts.length > 0 ? Array.from(new Set(efforts)) : [fallback];
    }
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};

export const resolveRouting = ({
  providers,
  provider,
  model,
  effort,
  recommendation,
}: Params): ResolvedRouting => {
  const resolvedProvider =
    provider !== ''
      ? provider
      : (recommendation?.provider ?? getModelProvider(model) ?? providers[0] ?? 'anthropic');
  const storedModel =
    model !== '' ? model : (recommendation?.model ?? getDefaultTurnModel({ id: resolvedProvider }));
  const stored = resolveStoredModelSelection({
    provider: resolvedProvider,
    id: storedModel,
    effort,
  });
  const catalog = MODEL_CATALOGS[resolvedProvider];
  const selectedModel =
    catalog.find((candidate) => candidate.key === stored.selection.key) ?? catalog[0];
  if (selectedModel == null) {
    throw new Error(`provider catalog is empty: ${resolvedProvider}`);
  }
  const resolved = resolveModelArgs({
    provider: resolvedProvider,
    selection: stored.selection,
  });
  const appliedEffort = resolved.clamped?.applied ?? stored.selection.effort ?? effort;
  const selection = { ...stored.selection, effort: appliedEffort };
  const effortLevels = effortsFor({
    model: selectedModel,
    selection,
    fallback: appliedEffort,
  });
  const hasThinkingToggle =
    selectedModel.provider === 'cursor' &&
    new Set(selectedModel.combos.map((combo) => combo.thinking)).size > 1;
  const hasFastToggle =
    selectedModel.provider === 'cursor' &&
    new Set(selectedModel.combos.map((combo) => combo.fast)).size > 1;
  return {
    provider: resolvedProvider,
    model: selectedModel.key,
    selection,
    effort: appliedEffort,
    effortLevels,
    ...(resolved.clamped != null && { clamped: resolved.clamped }),
    isEffortFixed: effortLevels.length <= 1,
    models: catalog.map((candidate) => candidate.key),
    catalog,
    hasThinkingToggle,
    hasFastToggle,
    isProviderRecommended: provider === '',
    isModelRecommended: model === '',
  };
};
