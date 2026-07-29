import type { CatalogModel, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';

const catalogCliId = (model: CatalogModel): string => {
  switch (model.provider) {
    case 'anthropic':
    case 'gemini':
    case 'opencode':
    case 'openrouter':
      return model.cliId;
    case 'codex': {
      const variant = model.variants[0];
      if (variant == null) {
        throw new Error(`codex model has no variants: ${model.key}`);
      }
      return variant.cliId;
    }
    case 'cursor': {
      const combo = model.combos[0];
      if (combo == null) {
        throw new Error(`cursor model has no combos: ${model.key}`);
      }
      return combo.slug;
    }
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};

type Params = {
  readonly provider: ProviderId;
  readonly model: string;
};

export const cliModelId = ({ provider, model }: Params): string => {
  const catalogEntry = MODEL_CATALOGS[provider].find((candidate) => candidate.key === model);
  return catalogEntry == null ? model : catalogCliId(catalogEntry);
};
