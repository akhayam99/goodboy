import type { ProviderId } from '@goodboy/types';
import type { VerbosityLevel } from '../../settings/verbosity';

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
};

export const PROVIDER_TEXT: Record<ProviderId, string> = {
  anthropic: 'text-[var(--color-provider-anthropic)]',
  cursor: 'text-[var(--color-provider-cursor)]',
  codex: 'text-[var(--color-provider-codex)]',
};

// Effort taxonomy matches the catalog's EffortLevel (packages/core/.../catalog/types.ts).
// Order matters: minimal (Codex) → low → medium → high → extra-high → max (Claude Opus).
// We stay on 'extra-high' (rather than Codex's wire name 'xhigh') to match the
// existing DB enum in packages/types/workspace.ts — saves a migration.
export const EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'extra-high', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

const SONNET_EFFORT: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high'];
const OPUS_EFFORT: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high', 'extra-high', 'max'];

// Legacy helper kept for back-compat with parts of the app that still ask
// "what efforts does THIS model id support" via regex (sidebar, agent
// metrics). Picker UX now uses listEfforts() from the catalog instead.
export function modelEffortLevels(model: string): ReadonlyArray<EffortLevel> | null {
  if (/claude-opus/i.test(model)) return OPUS_EFFORT;
  if (/claude-sonnet/i.test(model)) return SONNET_EFFORT;
  return null;
}

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  'extra-high': 'Very high',
  max: 'Max',
};

export const EFFORT_DOT: Record<EffortLevel, string> = {
  minimal: 'bg-muted',
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

export type CostTier = 'cheap' | 'mid' | 'expensive';

const MODEL_COST: Record<string, { weight: number; tier: CostTier }> = {
  'cursor-small': { weight: 4, tier: 'cheap' },
  'claude-haiku-4-5': { weight: 5, tier: 'cheap' },
  'codex-mini-latest': { weight: 6, tier: 'cheap' },
  'claude-sonnet-4-5': { weight: 14, tier: 'mid' },
  'claude-sonnet-4-6': { weight: 15, tier: 'mid' },
  'codex-latest': { weight: 20, tier: 'mid' },
  'claude-opus-4-6': { weight: 60, tier: 'expensive' },
  'claude-opus-4-7': { weight: 75, tier: 'expensive' },
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

export function modelLabel(id: string): string {
  const m = id.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)/i);
  if (m) {
    const family = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase();
    return `${family} ${m[2]}.${m[3]}`;
  }
  return id;
}

// Picker family taxonomy. Mirrors the catalog's ModelFamily enum + a few
// fallback buckets the regex parser uses when an id doesn't match a known
// pattern (e.g. user-typed manual override).
export type ModelFamily =
  | 'claude'
  | 'gpt'
  | 'composer'
  | 'cursor-auto'
  | 'gemini'
  | 'grok'
  | 'codex'
  | 'other';

export interface ParsedModel {
  readonly family: ModelFamily;
  readonly subfamily: string | null;
  readonly variantLabel: string;
}

// Strip a `provider/model` prefix so cursor's `gpt-5.5-high` and any future
// prefixed id (e.g. `openai/gpt-5.5-high`) parse the same way.
function stripProviderPrefix(id: string): string {
  const slash = id.indexOf('/');
  return slash >= 0 ? id.slice(slash + 1) : id;
}

export function parseModelId(id: string): ParsedModel {
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

  // Cursor's `auto` model — standalone family so it renders without a row label.
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
}

export function modelTier(model: string): CostTier {
  const known = MODEL_COST[model];
  if (known) return known.tier;
  if (/haiku|small|mini|flash|nano|fast/i.test(model)) return 'cheap';
  if (/opus|max/i.test(model)) return 'expensive';
  return 'mid';
}

export function modelWeight(model: string): number {
  return MODEL_COST[model]?.weight ?? 10;
}

// Heuristic floor used by the first-turn right-sizing card.
// Never suggest Haiku — user explicitly disallows it for this workspace.
const SUGGESTION_FLOOR_PATTERN = /haiku|small|mini|nano|cursor-small/i;

// Weight delta below which a suggestion is not worth surfacing (avoid nagging
// for marginal savings like Sonnet 4.6 → 4.5).
const MIN_WEIGHT_GAP = 20;

export function suggestLighterModel(
  current: string,
  candidates: ReadonlyArray<string>,
): string | null {
  const currentWeight = modelWeight(current);
  let best: { id: string; weight: number } | null = null;
  for (const id of candidates) {
    if (id === current) continue;
    if (SUGGESTION_FLOOR_PATTERN.test(id)) continue;
    const w = modelWeight(id);
    if (w >= currentWeight) continue;
    if (currentWeight - w < MIN_WEIGHT_GAP) continue;
    if (!best || w > best.weight) best = { id, weight: w };
  }
  return best?.id ?? null;
}

export const FAMILY_SECTION_LABEL: Record<ModelFamily, string> = {
  claude: 'Claude',
  gpt: 'GPT',
  composer: 'Composer',
  'cursor-auto': 'Auto',
  gemini: 'Gemini',
  grok: 'Grok',
  codex: 'Codex',
  other: 'Other',
};

const SUBFAMILY_LABEL: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
  composer: 'Composer',
  gemini: 'Gemini',
  grok: 'Grok',
  auto: 'Auto',
  gpt: 'GPT',
  'gpt-codex': 'Codex',
  'gpt-codex-max': 'Codex Max',
  'gpt-codex-mini': 'Codex Mini',
  'gpt-codex-spark': 'Codex Spark',
  'gpt-mini': 'Mini',
  'gpt-nano': 'Nano',
  'gpt-pro': 'Pro',
};

const SUBFAMILY_TIER: Record<string, CostTier> = {
  haiku: 'cheap',
  sonnet: 'mid',
  opus: 'expensive',
  composer: 'cheap',
  'gpt-mini': 'cheap',
  'gpt-nano': 'cheap',
  'gpt-codex-mini': 'cheap',
  'gpt-pro': 'expensive',
};

export function subfamilyLabel(family: ModelFamily, subfamily: string): string {
  if (SUBFAMILY_LABEL[subfamily]) return SUBFAMILY_LABEL[subfamily];
  if (family === 'gpt' && subfamily.endsWith('-codex')) {
    return subfamily.replace('-codex', '-Codex');
  }
  return subfamily;
}

export function subfamilyTier(family: ModelFamily, subfamily: string): CostTier {
  if (SUBFAMILY_TIER[subfamily]) return SUBFAMILY_TIER[subfamily];
  if (family === 'composer' || family === 'cursor-auto') return 'cheap';
  return 'mid';
}
