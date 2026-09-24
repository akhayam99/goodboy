import { modelHasEffortAxis } from '@goodboy/core';
import type { CatalogModel, EffortLevel, ModelSelection } from '@goodboy/types';

type Params = {
  readonly model: CatalogModel;
  readonly effort: EffortLevel;
};

export const selectionForModel = ({ model, effort }: Params): ModelSelection => {
  const tuning = modelHasEffortAxis({ model }) ? { effort } : {};
  switch (model.provider) {
    case 'anthropic':
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return { key: model.key, ...tuning };
    case 'codex':
      return { key: model.key, ...tuning, variant: model.variants[0]?.id };
    case 'cursor': {
      return {
        key: model.key,
        ...tuning,
        toggles: {
          thinking: false,
          fast: false,
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
