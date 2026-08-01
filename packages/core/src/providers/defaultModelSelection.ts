import type { ModelSelection, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';

type Params = {
  readonly provider: ProviderId;
  readonly tier?: 'turn' | 'cheap';
};

export const defaultModelSelection = ({ provider, tier = 'turn' }: Params): ModelSelection => {
  const catalog = MODEL_CATALOGS[provider];
  const model = catalog.find((candidate) => candidate.tier === tier) ?? catalog[0];
  if (model == null) {
    throw new Error(`provider catalog is empty: ${provider}`);
  }
  switch (model.provider) {
    case 'anthropic':
    case 'gemini':
    case 'opencode':
    case 'openrouter':
      return { key: model.key, effort: model.defaultEffort };
    case 'codex':
      return {
        key: model.key,
        effort: model.defaultEffort,
        variant: model.variants[0]?.id,
      };
    case 'cursor': {
      const combo = model.combos[0];
      return {
        key: model.key,
        ...(combo?.effort != null && { effort: combo.effort }),
        toggles: {
          thinking: combo?.thinking ?? false,
          fast: combo?.fast ?? false,
        },
      };
    }
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};
