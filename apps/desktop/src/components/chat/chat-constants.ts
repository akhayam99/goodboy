import type { ProviderId } from '@kay-am/types';
import type { VerbosityLevel } from '../../verbosity';

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: 'Claude',
  cursor: 'Cursor',
  codex: 'Codex',
  opencode: 'OpenCode',
};

export const PROVIDER_TEXT: Record<ProviderId, string> = {
  anthropic: 'text-[var(--color-provider-anthropic)]',
  cursor: 'text-[var(--color-provider-cursor)]',
  codex: 'text-[var(--color-provider-codex)]',
  opencode: 'text-[var(--color-provider-opencode)]',
};

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'extra-high', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

const SONNET_EFFORT: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high'];
const OPUS_EFFORT: ReadonlyArray<EffortLevel> = ['low', 'medium', 'high', 'extra-high', 'max'];

export function modelEffortLevels(model: string): ReadonlyArray<EffortLevel> | null {
  if (/claude-opus/i.test(model)) return OPUS_EFFORT;
  if (/claude-sonnet/i.test(model)) return SONNET_EFFORT;
  return null;
}

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  'extra-high': 'Very high',
  max: 'Max',
};

export const EFFORT_DOT: Record<EffortLevel, string> = {
  low: 'bg-success',
  medium: 'bg-info',
  high: 'bg-warning',
  'extra-high': 'bg-danger/80',
  max: 'bg-danger',
};

export const EFFORT_TEXT: Record<EffortLevel, string> = {
  low: 'text-success',
  medium: 'text-info',
  high: 'text-warning',
  'extra-high': 'text-danger/85',
  max: 'text-danger',
};

export type CostTier = 'cheap' | 'mid' | 'expensive';

export const MODEL_COST: Record<string, { weight: number; tier: CostTier }> = {
  'cursor-small': { weight: 4, tier: 'cheap' },
  'claude-haiku-4-5': { weight: 5, tier: 'cheap' },
  'codex-mini-latest': { weight: 6, tier: 'cheap' },
  'claude-sonnet-4-5': { weight: 14, tier: 'mid' },
  'claude-sonnet-4-6': { weight: 15, tier: 'mid' },
  'codex-latest': { weight: 20, tier: 'mid' },
  'claude-opus-4-6': { weight: 60, tier: 'expensive' },
  'claude-opus-4-7': { weight: 75, tier: 'expensive' },
};

export const FAMILY_LABEL: Record<string, string> = {
  claude: 'Claude',
  gpt: 'GPT',
  gemini: 'Gemini',
  cursor: 'Cursor',
  codex: 'Codex',
  other: 'Other',
};

export const TIER_TEXT: Record<CostTier, string> = {
  cheap: 'text-success',
  mid: 'text-warning',
  expensive: 'text-danger',
};

export const TIER_DOT: Record<CostTier, string> = {
  cheap: 'bg-success',
  mid: 'bg-warning',
  expensive: 'bg-danger',
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

export function modelFamily(id: string): string {
  if (id.startsWith('claude-')) return 'claude';
  if (id.startsWith('gpt-')) return 'gpt';
  if (id.startsWith('gemini-')) return 'gemini';
  if (id.startsWith('cursor-')) return 'cursor';
  if (id.startsWith('codex-')) return 'codex';
  return 'other';
}

export function modelTier(model: string): CostTier {
  const known = MODEL_COST[model];
  if (known) return known.tier;
  if (/haiku|small|mini|flash|nano/i.test(model)) return 'cheap';
  if (/opus|max/i.test(model)) return 'expensive';
  return 'mid';
}

export function modelWeight(model: string): number {
  return MODEL_COST[model]?.weight ?? 10;
}

export function modelSubfamily(id: string): string {
  const m = id.match(/^claude-(haiku|sonnet|opus)/i);
  return m ? m[1]!.toLowerCase() : '';
}

export function modelVersion(id: string): string {
  const m = id.match(/^claude-(?:haiku|sonnet|opus)-(\d+)-(\d+)/i);
  return m ? `${m[1]}.${m[2]}` : id;
}

export const CLAUDE_SUBFAMILY_LABEL: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
};

export const CLAUDE_SUBFAMILY_TIER: Record<string, CostTier> = {
  haiku: 'cheap',
  sonnet: 'mid',
  opus: 'expensive',
};
