import type { CatalogModel } from '@goodboy/types';

type Params = {
  readonly model: CatalogModel;
};

export const modelHasEffortAxis = ({ model }: Params): boolean => {
  switch (model.provider) {
    case 'anthropic':
    case 'codex':
    case 'gemini':
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return model.efforts.length > 0;
    case 'cursor':
      return model.combos.some((combo) => combo.effort != null);
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};
