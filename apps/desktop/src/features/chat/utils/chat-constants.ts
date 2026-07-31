import type { ModelCostTier, ModelEffort, ModelFamily, ProviderId } from '@goodboy/types';
import { getModelDescriptor, getModelPrice } from '@goodboy/core';
import type { VerbosityLevel } from '../../settings/verbosity';

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  openrouter: 'OpenRouter',
};

export const EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = ModelEffort;

const SONNET_EFFORT: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high'];
const OPUS_EFFORT: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high', 'xhigh', 'max'];
const CODEX_EFFORT: ReadonlyArray<EffortLevel> = ['minimal', 'low', 'medium', 'high'];

export const modelEffortLevels = (model: string): ReadonlyArray<EffortLevel> | null => {
  const descriptor = getModelDescriptor(model);
  if (descriptor != null) {
    return descriptor.effort != null && descriptor.effort.length > 0 ? descriptor.effort : null;
  }
  if (/claude-opus/i.test(model)) {
    return OPUS_EFFORT;
  }
  if (/claude-sonnet/i.test(model)) {
    return SONNET_EFFORT;
  }
  if (/gpt|codex/i.test(model)) {
    return CODEX_EFFORT;
  }
  return null;
};

export const clampEffort = (model: string, effort: EffortLevel): EffortLevel => {
  const levels = modelEffortLevels(model);
  if (levels == null || levels.includes(effort)) {
    return effort;
  }
  const requestedIndex = EFFORT_LEVELS.indexOf(effort);
  for (let index = requestedIndex - 1; index >= 0; index -= 1) {
    const candidate = EFFORT_LEVELS[index];
    if (candidate != null && levels.includes(candidate)) {
      return candidate;
    }
  }
  for (let index = requestedIndex + 1; index < EFFORT_LEVELS.length; index += 1) {
    const candidate = EFFORT_LEVELS[index];
    if (candidate != null && levels.includes(candidate)) {
      return candidate;
    }
  }
  return effort;
};

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Very high',
  max: 'Max',
};

export const EFFORT_DOT: Record<EffortLevel, string> = {
  minimal: 'bg-muted-foreground',
  low: 'bg-success',
  medium: 'bg-info',
  high: 'bg-warning',
  xhigh: 'bg-danger/80',
  max: 'bg-danger',
};

export const EFFORT_TEXT: Record<EffortLevel, string> = {
  minimal: 'text-muted-foreground',
  low: 'text-success',
  medium: 'text-info',
  high: 'text-warning',
  xhigh: 'text-danger/85',
  max: 'text-danger',
};

export type CostTier = ModelCostTier;

const FALLBACK_WEIGHT = 10;

export const TIER_TEXT: Record<CostTier, string> = {
  cheap: 'text-success',
  mid: 'text-warning',
  expensive: 'text-danger',
};

export const VERBOSITY_TEXT: Record<VerbosityLevel, string> = {
  brief: 'text-success',
  normal: 'text-info',
  verbose: 'text-danger',
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

export type { ModelFamily };

export type ParsedModel = {
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

export const modelTier = (model: string): CostTier => {
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

export const modelWeight = (model: string): number => {
  return getModelDescriptor(model)?.weight ?? FALLBACK_WEIGHT;
};

const TIER_RANK: Record<CostTier, number> = { cheap: 0, mid: 1, expensive: 2 };

export type ModelSuggestion = {
  readonly id: string;
  readonly kind: 'strong' | 'optional';
  readonly costMultiplier: number | null;
};

const costRatio = (numerator: string, denominator: string): number | null => {
  const a = getModelPrice(numerator);
  const b = getModelPrice(denominator);
  if (!a || !b) {
    return null;
  }
  const avg = (a.inputPerMtok / b.inputPerMtok + a.outputPerMtok / b.outputPerMtok) / 2;
  const rounded = Math.round(avg * 10) / 10;
  return rounded === 1 ? null : rounded;
};

export const suggestLighterModel = (
  current: string,
  candidates: ReadonlyArray<string>,
): ModelSuggestion | null => {
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
    if (!best || weight > best.weight) {
      best = { id, weight };
    }
  }
  if (!best) {
    return null;
  }
  return { id: best.id, kind: 'strong', costMultiplier: costRatio(current, best.id) };
};

export const suggestHeavierModel = (
  current: string,
  candidates: ReadonlyArray<string>,
): ModelSuggestion | null => {
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
    if (!best || rank > best.rank || (rank === best.rank && weight > best.weight)) {
      best = { id, rank, weight };
    }
  }
  if (!best) {
    return null;
  }
  const kind = modelTier(current) === 'expensive' ? 'optional' : 'strong';
  return { id: best.id, kind, costMultiplier: costRatio(best.id, current) };
};
