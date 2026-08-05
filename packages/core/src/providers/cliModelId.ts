import type { CatalogModel, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { CURSOR_AUTO_MODEL } from './cursor/models';

const catalogCliId = (model: CatalogModel): string => {
  switch (model.provider) {
    case 'anthropic':
    case 'gemini':
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return model.cliId;
    case 'codex': {
      const variant = model.variants[0];
      if (variant == null) {
        throw new Error(`codex model has no variants: ${model.key}`);
      }
      return variant.cliId;
    }
    case 'cursor': {
      const combo = model.combos.find((candidate) => candidate.maxMode === false);
      if (model.combos.length === 0) {
        throw new Error(`cursor model has no combos: ${model.key}`);
      }
      return combo?.slug ?? CURSOR_AUTO_MODEL;
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
