import type { EffortLevel, ModelCostTier, ModelFamily, ProviderId } from '@goodboy/types';
import { getModelDescriptor, getProviderModelPrice } from '@goodboy/core';

export const EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Very high',
  max: 'Max',
};

const FALLBACK_WEIGHT = 10;

export const TIER_TEXT: Record<ModelCostTier, string> = {
  cheap: 'text-success',
  mid: 'text-warning',
  expensive: 'text-danger',
};

const FAMILY_LABEL: Record<ModelFamily, string> = {
  claude: 'Claude',
  gpt: 'GPT',
  codex: 'Codex',
  gemini: 'Gemini',
  composer: 'Composer',
  'cursor-auto': 'Cursor',
  other: '',
};

type SlugWordsParams = {
  readonly slug: string;
};

const slugToWords = ({ slug }: SlugWordsParams): string =>
  slug
    .split(/[-_\s/]+/)
    .filter((part) => part !== '')
    .map((part) => (/^[a-z]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');

export const modelLabel = (id: string): string => {
  const descriptor = getModelDescriptor(id);
  if (descriptor) {
    return descriptor.label;
  }
  const m = id.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)/i);
  if (m) {
    const family = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
    return `${family} ${m[2]}.${m[3]}`;
  }
  const parsed = parseModelId(id);
  const family = FAMILY_LABEL[parsed.family];
  const isSubfamilyRedundant =
    parsed.subfamily == null ||
    family === '' ||
    parsed.subfamily.toLowerCase().startsWith(family.toLowerCase());
  const subfamily = isSubfamilyRedundant ? '' : slugToWords({ slug: parsed.subfamily });
  const label = [family, subfamily, slugToWords({ slug: parsed.variantLabel })]
    .filter((part) => part !== '')
    .join(' ');
  return label === '' ? id : label;
};

type ParsedModel = {
  readonly family: ModelFamily;
  readonly subfamily: string | null;
  readonly variantLabel: string;
};

function stripProviderPrefix(id: string): string {
  const slash = id.indexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}

export const parseModelId = (id: string): ParsedModel => {
  const local = stripProviderPrefix(id);
  const catalogDescriptor = getModelDescriptor(local);
  if (catalogDescriptor != null && catalogDescriptor.id === local) {
    return {
      family: catalogDescriptor.family,
      subfamily: catalogDescriptor.subfamily,
      variantLabel: catalogDescriptor.variantLabel,
    };
  }

  let m = local.match(/^claude-(haiku|sonnet|opus|fable)-(\d+)(?:-(\d+))?(?:-(.+))?$/i);
  if (m) {
    const version = m[3] == null ? m[2]! : `${m[2]}.${m[3]}`;
    const suffix = m[4]
      ?.split('-')
      .filter((part) => part !== 'thinking')
      .join(' ');
    return {
      family: 'claude',
      subfamily: m[1]!.toLowerCase(),
      variantLabel: suffix != null && suffix !== '' ? `${version} ${suffix}` : version,
    };
  }

  m = local.match(/^claude-(\d+\.\d+)-(haiku|sonnet|opus)(?:-(.+))?$/i);
  if (m) {
    const suffix = m[3] ? ` ${m[3].replace(/-/g, ' ')}` : '';
    return {
      family: 'claude',
      subfamily: m[2]!.toLowerCase(),
      variantLabel: `${m[1]}${suffix}`,
    };
  }

  m = local.match(/^composer-(.+)$/i);
  if (m) {
    const variantLabel = m[1]!
      .split('-')
      .map((part) => (part === 'fast' ? 'Fast' : part))
      .join(' ');
    return { family: 'composer', subfamily: null, variantLabel };
  }

  if (local === 'auto') {
    return { family: 'cursor-auto', subfamily: null, variantLabel: 'auto' };
  }

  m = local.match(/^gpt-(\d+\.\d+)-codex(?:-spark)?$/i);
  if (m) {
    return { family: 'gpt', subfamily: 'codex', variantLabel: m[1]! };
  }

  m = local.match(/^gpt-(\d+\.\d+)-mini$/i);
  if (m) {
    return { family: 'gpt', subfamily: 'mini', variantLabel: m[1]! };
  }

  m = local.match(/^gpt-(\d+\.\d+)-(low|medium|high|xhigh|max)$/i);
  if (m) {
    return {
      family: 'gpt',
      subfamily: 'gpt-5',
      variantLabel: `${m[1]} ${m[2]!.toLowerCase()}`,
    };
  }

  m = local.match(/^gpt-(\d+\.\d+)$/i);
  if (m) {
    return {
      family: 'gpt',
      subfamily: id.includes('/') ? m[1]! : 'gpt-5',
      variantLabel: m[1]!,
    };
  }

  const descriptor = getModelDescriptor(id);
  if (descriptor != null) {
    return {
      family: descriptor.family,
      subfamily: descriptor.subfamily,
      variantLabel: descriptor.variantLabel,
    };
  }

  m = local.match(/^gpt-(.+)$/i);
  if (m) {
    return { family: 'gpt', subfamily: null, variantLabel: m[1]! };
  }

  if (local.startsWith('gemini-')) {
    return { family: 'gemini', subfamily: null, variantLabel: local.slice('gemini-'.length) };
  }

  if (local.startsWith('codex-')) {
    return { family: 'codex', subfamily: null, variantLabel: local.slice('codex-'.length) };
  }

  return { family: 'other', subfamily: null, variantLabel: local };
};

export const modelTier = (model: string): ModelCostTier => {
  const descriptor = getModelDescriptor(model);
  if (descriptor) {
    return descriptor.costTier;
  }
  if (/haiku|small|mini|flash|nano|fast/i.test(model)) {
    return 'cheap';
  }
  if (/opus|max/i.test(model)) {
    return 'expensive';
  }
  return 'mid';
};

const modelWeight = (model: string): number => {
  return getModelDescriptor(model)?.weight ?? FALLBACK_WEIGHT;
};

const TIER_RANK: Record<ModelCostTier, number> = { cheap: 0, mid: 1, expensive: 2 };

export type ModelSuggestion = {
  readonly id: string;
  readonly kind: 'strong' | 'optional';
  readonly costMultiplier: number | null;
};

type CostRatioParams = {
  readonly provider: ProviderId;
  readonly numerator: string;
  readonly denominator: string;
};

const costRatio = ({ provider, numerator, denominator }: CostRatioParams): number | null => {
  const a = getProviderModelPrice({ provider, model: numerator });
  const b = getProviderModelPrice({ provider, model: denominator });
  if (a === null || b === null) {
    return null;
  }
  const avg = (a.inputPerMtok / b.inputPerMtok + a.outputPerMtok / b.outputPerMtok) / 2;
  const rounded = Math.round(avg * 10) / 10;
  return rounded === 1 ? null : rounded;
};

type SuggestionParams = {
  readonly provider: ProviderId;
  readonly current: string;
  readonly candidates: ReadonlyArray<string>;
};

export const suggestLighterModel = ({
  provider,
  current,
  candidates,
}: SuggestionParams): ModelSuggestion | null => {
  const currentRank = TIER_RANK[modelTier(current)];
  let best: { id: string; weight: number } | null = null;
  for (const id of candidates) {
    if (id === current) {
      continue;
    }
    const rank = TIER_RANK[modelTier(id)];
    if (rank >= currentRank || rank === TIER_RANK.cheap) {
      continue;
    }
    const weight = modelWeight(id);
    if (best === null || weight > best.weight) {
      best = { id, weight };
    }
  }
  if (best === null) {
    return null;
  }
  return {
    id: best.id,
    kind: 'strong',
    costMultiplier: costRatio({ provider, numerator: current, denominator: best.id }),
  };
};

export const suggestHeavierModel = ({
  provider,
  current,
  candidates,
}: SuggestionParams): ModelSuggestion | null => {
  const currentRank = TIER_RANK[modelTier(current)];
  const currentWeight = modelWeight(current);
  let best: { id: string; rank: number; weight: number } | null = null;
  for (const id of candidates) {
    if (id === current) {
      continue;
    }
    const rank = TIER_RANK[modelTier(id)];
    const weight = modelWeight(id);
    if (rank < currentRank || weight <= currentWeight) {
      continue;
    }
    if (best === null || rank > best.rank || (rank === best.rank && weight > best.weight)) {
      best = { id, rank, weight };
    }
  }
  if (best === null) {
    return null;
  }
  const kind = modelTier(current) === 'expensive' ? 'optional' : 'strong';
  return {
    id: best.id,
    kind,
    costMultiplier: costRatio({ provider, numerator: best.id, denominator: current }),
  };
};
