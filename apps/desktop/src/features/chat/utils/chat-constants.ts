import type { ModelCostTier, ModelEffort, ModelFamily, ProviderId } from '@goodboy/types';
import { getModelDescriptor } from '@goodboy/core';
import type { VerbosityLevel } from '../../settings/verbosity';

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
  gemini: 'Gemini',
};

export const PROVIDER_TEXT: Record<ProviderId, string> = {
  anthropic: 'text-[var(--color-provider-anthropic)]',
  cursor: 'text-[var(--color-provider-cursor)]',
  codex: 'text-[var(--color-provider-codex)]',
  gemini: 'text-[var(--color-provider-gemini)]',
};

export const EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'extra-high', 'max'] as const;
export type EffortLevel = ModelEffort;

const SONNET_EFFORT: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high'];
const OPUS_EFFORT: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high', 'extra-high', 'max'];
const CODEX_EFFORT: ReadonlyArray<EffortLevel> = ['minimal', 'low', 'medium', 'high'];

export const modelEffortLevels = (model: string): ReadonlyArray<EffortLevel> | null => {
  const descriptor = getModelDescriptor(model);
  if (descriptor) return descriptor.effort;
  if (/claude-opus/i.test(model)) return OPUS_EFFORT;
  if (/claude-sonnet/i.test(model)) return SONNET_EFFORT;
  if (/gpt|codex/i.test(model)) return CODEX_EFFORT;
  return null;
};

export const clampEffort = (model: string, effort: EffortLevel): EffortLevel => {
  const levels = modelEffortLevels(model);
  if (!levels) return effort;
  return levels.includes(effort) ? effort : (levels[levels.length - 1] ?? effort);
};

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  'extra-high': 'Very high',
  max: 'Max',
};

export const EFFORT_DOT: Record<EffortLevel, string> = {
  minimal: 'bg-muted-foreground',
  low: 'bg-success',
  medium: 'bg-info',
  high: 'bg-warning',
  'extra-high': 'bg-danger/80',
  max: 'bg-danger',
};

export const EFFORT_TEXT: Record<EffortLevel, string> = {
  minimal: 'text-muted-foreground',
  low: 'text-success',
  medium: 'text-info',
  high: 'text-warning',
  'extra-high': 'text-danger/85',
  max: 'text-danger',
};

export type CostTier = ModelCostTier;

const MODEL_COST: Record<string, { weight: number; tier: CostTier }> = {
  'cursor-small': { weight: 4, tier: 'cheap' },
  'claude-haiku-4-5': { weight: 5, tier: 'cheap' },
  'codex-mini-latest': { weight: 6, tier: 'cheap' },
  'claude-sonnet-4-5': { weight: 14, tier: 'mid' },
  'claude-sonnet-4-6': { weight: 15, tier: 'mid' },
  'codex-latest': { weight: 20, tier: 'mid' },
  'claude-opus-4-6': { weight: 60, tier: 'expensive' },
  'claude-opus-4-7': { weight: 75, tier: 'expensive' },
  'claude-opus-4-8': { weight: 80, tier: 'expensive' },
};

export const TIER_TEXT: Record<CostTier, string> = {
  cheap: 'text-success',
  mid: 'text-warning',
  expensive: 'text-danger',
};

export const VERBOSITY_DOT: Record<VerbosityLevel, string> = {
  brief: 'bg-success',
  normal: 'bg-info',
  verbose: 'bg-danger',
};

export const VERBOSITY_TEXT: Record<VerbosityLevel, string> = {
  brief: 'text-success',
  normal: 'text-info',
  verbose: 'text-danger',
};

export const modelLabel = (id: string): string => {
  const descriptor = getModelDescriptor(id);
  if (descriptor) return descriptor.label;
  const m = id.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)/i);
  if (m) {
    const family = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
    return `${family} ${m[2]}.${m[3]}`;
  }
  return id;
};

export type { ModelFamily };

export type ParsedModel = {
  readonly family: ModelFamily;
  readonly subfamily: string | null;
  readonly variantLabel: string;
};

// Strip a `provider/model` prefix so cursor's `gpt-5.5-high` and any future
// prefixed id (e.g. `openai/gpt-5.5-high`) parse the same way.
function stripProviderPrefix(id: string): string {
  const slash = id.indexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}

export const parseModelId = (id: string): ParsedModel => {
  const descriptor = getModelDescriptor(id);
  if (descriptor) {
    return {
      family: descriptor.family,
      subfamily: descriptor.subfamily,
      variantLabel: descriptor.variantLabel,
    };
  }

  const local = stripProviderPrefix(id);

  // Canonical anthropic: claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-7
  let m = local.match(/^claude-(haiku|sonnet|opus)-(\d+)-(\d+)(?:-(.+))?$/i);
  if (m) {
    return {
      family: 'claude',
      subfamily: m[1]!.toLowerCase(),
      variantLabel: `${m[2]}.${m[3]}`,
    };
  }

  // Cursor's anthropic naming: claude-4.6-sonnet-medium, claude-4.6-opus-high-thinking
  m = local.match(/^claude-(\d+\.\d+)-(haiku|sonnet|opus)(?:-(.+))?$/i);
  if (m) {
    const suffix = m[3] ? ` ${m[3].replace(/-/g, ' ')}` : '';
    return {
      family: 'claude',
      subfamily: m[2]!.toLowerCase(),
      variantLabel: `${m[1]}${suffix}`,
    };
  }

  // Composer (cursor first-party): composer-2, composer-2-fast
  m = local.match(/^composer-(.+)$/i);
  if (m) {
    return { family: 'composer', subfamily: null, variantLabel: m[1]! };
  }

  // Cursor's `auto` model, standalone family so it renders without a row label.
  if (local === 'auto') {
    return { family: 'cursor-auto', subfamily: null, variantLabel: 'auto' };
  }

  // gpt-X.Y-codex → its own subfamily so it visually groups separately from
  // the generic gpt-X.Y row (mockup: `5.3-codex [codex]`).
  m = local.match(/^gpt-(\d+\.\d+)-codex$/i);
  if (m) {
    return { family: 'gpt', subfamily: `${m[1]}-codex`, variantLabel: 'codex' };
  }

  // gpt-X.Y-<variant> (variant = high/medium/mini/...)
  m = local.match(/^gpt-(\d+\.\d+)-(.+)$/i);
  if (m) {
    return { family: 'gpt', subfamily: m[1]!, variantLabel: m[2]! };
  }

  // bare gpt-X.Y
  m = local.match(/^gpt-(\d+\.\d+)$/i);
  if (m) {
    return { family: 'gpt', subfamily: m[1]!, variantLabel: m[1]! };
  }

  // unparseable gpt fallback
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
  if (descriptor) return descriptor.costTier;
  const known = MODEL_COST[model];
  if (known) return known.tier;
  if (/haiku|small|mini|flash|nano|fast/i.test(model)) return 'cheap';
  if (/opus|max/i.test(model)) return 'expensive';
  return 'mid';
};

export const modelWeight = (model: string): number => {
  const descriptor = getModelDescriptor(model);
  if (descriptor) return descriptor.weight;
  return MODEL_COST[model]?.weight ?? 10;
};

// Heuristic floor used by the first-turn right-sizing card.
// Never suggest Haiku, user explicitly disallows it for this workspace.
const SUGGESTION_FLOOR_PATTERN = /haiku|small|mini|nano|cursor-small/i;

// Weight delta below which a suggestion is not worth surfacing (avoid nagging
// for marginal savings like Sonnet 4.6 → 4.5).
const MIN_WEIGHT_GAP = 20;

const TIER_RANK: Record<CostTier, number> = { cheap: 0, mid: 1, expensive: 2 };

export const suggestLighterModel = (
  current: string,
  candidates: ReadonlyArray<string>,
): string | null => {
  const currentWeight = modelWeight(current);
  const eligible = candidates.filter((id) => {
    if (id === current) return false;
    if (SUGGESTION_FLOOR_PATTERN.test(id)) return false;
    const w = modelWeight(id);
    return w < currentWeight && currentWeight - w >= MIN_WEIGHT_GAP;
  });
  if (eligible.length === 0) return null;
  let best: { id: string; tierRank: number; weight: number } | null = null;
  for (const id of eligible) {
    const tierRank = TIER_RANK[modelTier(id)];
    const weight = modelWeight(id);
    if (!best || tierRank < best.tierRank || (tierRank === best.tierRank && weight > best.weight)) {
      best = { id, tierRank, weight };
    }
  }
  return best?.id ?? null;
};

export const FAMILY_SECTION_LABEL: Record<ModelFamily, string> = {
  claude: 'Claude',
  gpt: 'GPT',
  composer: 'Composer',
  'cursor-auto': 'Auto',
  gemini: 'Gemini',
  codex: 'Codex',
  other: 'Other',
};

const SUBFAMILY_LABEL: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
  'gpt-5': 'GPT-5',
  codex: 'Codex',
  mini: 'Mini',
  pro: 'Pro',
  flash: 'Flash',
};

const SUBFAMILY_TIER: Record<string, CostTier> = {
  haiku: 'cheap',
  sonnet: 'mid',
  opus: 'expensive',
  'gpt-5': 'mid',
  codex: 'mid',
  mini: 'cheap',
  pro: 'expensive',
  flash: 'cheap',
};

export const subfamilyLabel = (family: ModelFamily, subfamily: string): string => {
  if (SUBFAMILY_LABEL[subfamily]) return SUBFAMILY_LABEL[subfamily];
  if (family === 'gpt' && subfamily.endsWith('-codex')) {
    return subfamily.replace('-codex', '-Codex');
  }
  return subfamily;
};

export const subfamilyTier = (_family: ModelFamily, subfamily: string): CostTier => {
  return SUBFAMILY_TIER[subfamily] ?? 'mid';
};
