import type {
  CatalogModel,
  ModelSelection,
  ProviderId,
  RemappedModelSelection,
} from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { resolveModelArgs } from './resolveModelArgs';

type Params = {
  readonly sourceProvider: ProviderId;
  readonly targetProvider: ProviderId;
  readonly selection: ModelSelection;
};

type SelectionParams = {
  readonly model: CatalogModel;
  readonly effort: ModelSelection['effort'];
};

const selectionFor = ({ model, effort }: SelectionParams): ModelSelection => {
  switch (model.provider) {
    case 'anthropic':
    case 'opencode':
    case 'openrouter':
      return { key: model.key, effort: effort ?? model.defaultEffort };
    case 'codex':
      return {
        key: model.key,
        effort: effort ?? model.defaultEffort,
        variant: model.variants[0]?.id,
      };
    case 'cursor': {
      const combo = model.combos[0];
      return {
        key: model.key,
        ...(effort != null && { effort }),
        toggles: {
          thinking: combo?.thinking ?? false,
          fast: combo?.fast ?? false,
        },
      };
    }
    case 'gemini':
      return { key: model.key };
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};

export const remapModelSelection = ({
  sourceProvider,
  targetProvider,
  selection,
}: Params): RemappedModelSelection => {
  const source = MODEL_CATALOGS[sourceProvider].find((model) => model.key === selection.key);
  if (source == null) {
    throw new Error(`unknown model key for ${sourceProvider}: ${selection.key}`);
  }
  const exact = MODEL_CATALOGS[targetProvider].find((model) => model.key === selection.key);
  const target =
    exact ??
    MODEL_CATALOGS[targetProvider].find((model) => model.tier === source.tier) ??
    MODEL_CATALOGS[targetProvider][0];
  if (target == null) {
    throw new Error(`provider catalog is empty: ${targetProvider}`);
  }
  const targetSelection = selectionFor({ model: target, effort: selection.effort });
  const resolved = resolveModelArgs({ provider: targetProvider, selection: targetSelection });
  const appliedSelection =
    resolved.clamped == null
      ? targetSelection
      : { ...targetSelection, effort: resolved.clamped.applied };
  return {
    selection: appliedSelection,
    record: {
      sourceProvider,
      targetProvider,
      sourceKey: source.key,
      targetKey: target.key,
      reason: exact == null ? 'tier-default' : 'same-key',
      ...(resolved.clamped != null && { clamped: resolved.clamped }),
    },
  };
};
