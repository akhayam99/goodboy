import type { CatalogModel, ModelDescriptor } from '@goodboy/types';

type Params = {
  readonly model: CatalogModel;
};

const THINKER_ONLY_KEYS: ReadonlySet<string> = new Set(['fable-5', 'fable-5.1']);

const WEIGHT_BY_KEY: Readonly<Record<string, number>> = {
  'opus-5': 85,
  'fable-5.1': 95,
  'fable-5': 90,
  'opus-4.8': 80,
  'opus-4.7': 75,
  'opus-4.6': 60,
  'sonnet-5': 16,
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
  'kimi-k3': 12,
};

const effortFor = ({ model }: Params) => {
  switch (model.provider) {
    case 'anthropic':
    case 'codex':
    case 'gemini':
    case 'opencode':
    case 'openrouter':
    case 'moonshot':
      return model.efforts.length > 0 ? model.efforts : null;
    case 'cursor': {
      const efforts = model.combos.map((combo) => combo.effort).filter((effort) => effort != null);
      return efforts.length > 0 ? Array.from(new Set(efforts)) : null;
    }
    default: {
      const exhaustive: never = model;
      throw new Error(`unknown catalog model: ${String(exhaustive)}`);
    }
  }
};

export const catalogDescriptor = ({ model }: Params): ModelDescriptor => {
  const family = model.presentation.family;
  return {
    id: model.key,
    tier: model.tier,
    contextWindow: model.contextWindow,
    family,
    subfamily: model.presentation.group,
    label: model.label,
    variantLabel: model.presentation.version,
    costTier: model.presentation.costTier,
    weight: WEIGHT_BY_KEY[model.key] ?? 10,
    effort: effortFor({ model }),
    thinkerOnly: THINKER_ONLY_KEYS.has(model.key),
  };
};
