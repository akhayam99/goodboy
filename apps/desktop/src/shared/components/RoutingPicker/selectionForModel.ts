import type { CatalogModel, EffortLevel, ModelSelection } from '@goodboy/types';

type Params = {
  readonly model: CatalogModel;
  readonly effort: EffortLevel;
};

export const selectionForModel = ({ model, effort }: Params): ModelSelection => {
  switch (model.provider) {
    case 'anthropic':
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return { key: model.key, effort };
    case 'codex':
      return { key: model.key, effort, variant: model.variants[0]?.id };
    case 'cursor': {
      return {
        key: model.key,
        effort,
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
