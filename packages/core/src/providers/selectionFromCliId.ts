import type { ModelSelection, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';

type Params = {
  readonly provider: ProviderId;
  readonly id: string;
};

export const selectionFromCliId = ({ provider, id }: Params): ModelSelection | null => {
  for (const model of MODEL_CATALOGS[provider]) {
    switch (model.provider) {
      case 'anthropic':
      case 'gemini':
      case 'opencode':
      case 'openrouter':
        if (model.cliId === id) {
          return { key: model.key };
        }
        break;
      case 'codex': {
        const variant = model.variants.find((candidate) => candidate.cliId === id);
        if (variant != null) {
          return { key: model.key, variant: variant.id };
        }
        break;
      }
      case 'cursor': {
        const combo = model.combos.find((candidate) => candidate.slug === id);
        if (combo != null) {
          return {
            key: model.key,
            ...(combo.effort != null && { effort: combo.effort }),
            toggles: { thinking: combo.thinking, fast: combo.fast },
          };
        }
        break;
      }
      default: {
        const exhaustive: never = model;
        throw new Error(`unknown catalog model: ${String(exhaustive)}`);
      }
    }
  }
  return null;
};
