import type { CatalogModel, ModelDescriptor, ModelFamily } from '@goodboy/types';

type Params = {
  readonly model: CatalogModel;
};

const WEIGHT_BY_KEY: Readonly<Record<string, number>> = {
  'opus-5': 85,
  'fable-5': 90,
  'opus-4.8': 80,
  'opus-4.7': 75,
  'opus-4.6': 60,
  'sonnet-4.6': 15,
  'sonnet-4.5': 14,
  'haiku-4.5': 5,
  'gpt-5.6': 28,
  'gpt-5.5': 25,
  'gpt-5.4': 22,
  'gpt-5.4-mini': 6,
  'composer-2.5': 12,
  auto: 4,
  'gemini-3.1-pro': 20,
  'gemini-3.5-flash': 5,
};

const familyFor = ({ model }: Params): ModelFamily => {
  if (
    model.key.startsWith('opus-') ||
    model.key.startsWith('sonnet-') ||
    model.key.startsWith('haiku-') ||
    model.key.startsWith('fable-')
  ) {
    return 'claude';
  }
  if (model.key.startsWith('gpt-')) {
    return 'gpt';
  }
  if (model.key.startsWith('gemini-')) {
    return 'gemini';
  }
  if (model.key.startsWith('composer-')) {
    return 'composer';
  }
  if (model.key === 'auto') {
    return 'cursor-auto';
  }
  return 'other';
};

const subfamilyFor = ({ model }: Params): string | null => {
  const family = familyFor({ model });
  if (family === 'claude') {
    return model.key.split('-')[0] ?? null;
  }
  if (family === 'gpt') {
    return model.key.endsWith('-mini') ? 'mini' : 'gpt-5';
  }
  if (family === 'gemini') {
    return model.key.includes('flash') ? 'flash' : 'pro';
  }
  return null;
};

const cliIdFor = ({ model }: Params): string => {
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

const effortFor = ({ model }: Params) => {
  switch (model.provider) {
    case 'anthropic':
    case 'codex':
    case 'opencode':
    case 'openrouter':
      return model.efforts.length > 0 ? model.efforts : null;
    case 'cursor': {
      const efforts = model.combos.map((combo) => combo.effort).filter((effort) => effort != null);
      return efforts.length > 0 ? Array.from(new Set(efforts)) : null;
    }
    case 'gemini':
      return null;
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};

export const catalogDescriptor = ({ model }: Params): ModelDescriptor => {
  const family = familyFor({ model });
  return {
    id: model.key,
    tier: model.tier,
    contextWindow: family === 'gemini' || family === 'claude' ? 1_000_000 : 200_000,
    family,
    subfamily: subfamilyFor({ model }),
    label: model.label,
    variantLabel: model.label,
    costTier:
      model.tier === 'cheap'
        ? 'cheap'
        : (family === 'claude' &&
              (model.key.startsWith('opus-') || model.key.startsWith('fable-'))) ||
            model.key === 'gpt-5.6' ||
            model.key === 'gpt-5.5'
          ? 'expensive'
          : 'mid',
    weight: WEIGHT_BY_KEY[model.key] ?? 10,
    effort: effortFor({ model }),
  };
};
