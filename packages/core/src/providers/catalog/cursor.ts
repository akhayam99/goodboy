import type { EffortLevel, ModelEntry, ModelFamily, ModelSubfamily, ModelTier } from './types';

// Sourced from a live probe of `cursor-agent models` (v2026.05.07).
// Cursor encodes effort + modifiers ("thinking", "fast") directly INTO the
// model id, unlike Anthropic + Codex which pass them as separate flags. The
// picker presents effort/thinking/fast as orthogonal axes anyway; the catalog
// flattens every valid combination into its own ModelEntry so a (family,
// version, effort, thinking, fast) selection resolves to exactly one cliId.
//
// Generation rules (rather than hand-listing all ~100 ids):
//   - GPT-5 / Composer: { effort } × { fast }
//   - Claude (Opus): { effort } × { thinking } × { fast }
//   - Claude (Sonnet 4.6): { thinking } × { fast } (single effort baked in)
//   - Single-flavor lines (Sonnet 4.5, Gemini, Grok) listed manually.

interface CursorFamilyConfig {
  readonly family: ModelFamily;
  readonly subfamily: ModelSubfamily;
  readonly version: string;
  readonly contextWindow: number;
  readonly tier: ModelTier;
  // Prefix BEFORE the effort token. Either `prefix-{effort}-fast?` or
  // `prefix-{effort}` (when fast=false). Set to `null` to skip effort entirely.
  readonly cliPrefix: string;
  readonly efforts: ReadonlyArray<EffortLevel> | null;
  // Map our canonical effort to the Cursor-specific suffix. Cursor uses
  // `extra-high` on some families and `xhigh` on others.
  readonly effortSuffix: Record<EffortLevel, string>;
  readonly supportsFast: boolean;
  readonly supportsThinking: boolean;
  readonly hidden?: boolean;
  readonly deprecated?: boolean;
}

// Cursor encodes the "extra-high" tier in two different ways depending on the
// underlying model family — `xhigh` for GPT-5.4 / Claude / Composer, but
// `extra-high` (literal) for GPT-5.5 only. Both maps key on the canonical
// EffortLevel name and produce the Cursor suffix.
const XHIGH_AS_XHIGH: Record<EffortLevel, string> = {
  minimal: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
  'extra-high': 'xhigh',
  max: 'max',
};

const XHIGH_AS_EXTRA_HIGH: Record<EffortLevel, string> = {
  minimal: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
  'extra-high': 'extra-high',
  max: 'max',
};

function expandFamily(cfg: CursorFamilyConfig): ReadonlyArray<ModelEntry> {
  const out: ModelEntry[] = [];
  const fastOptions = cfg.supportsFast ? [false, true] : [false];
  const thinkingOptions = cfg.supportsThinking ? [false, true] : [false];
  const efforts = cfg.efforts ?? [null];

  for (const effort of efforts) {
    for (const thinking of thinkingOptions) {
      for (const fast of fastOptions) {
        const parts: string[] = [cfg.cliPrefix];
        if (thinking) parts.push('thinking');
        if (effort !== null) parts.push(cfg.effortSuffix[effort]);
        if (fast) parts.push('fast');
        const cliId = parts.join('-');
        // Composer 2.5 cheap-tier convention: only the -fast variant is the
        // "balance default" pick; the non-fast variant is a regular turn
        // model. Keeps downstream `getCheapModel(...)` from accidentally
        // picking the slower composer-2.5.
        const isComposerCheap = cfg.family === 'composer' && cfg.version === '2.5' && fast === true;
        const resolvedTier = isComposerCheap ? 'cheap' : cfg.tier;
        out.push({
          provider: 'cursor',
          family: cfg.family,
          subfamily: cfg.subfamily,
          version: cfg.version,
          contextWindow: cfg.contextWindow,
          tier: resolvedTier,
          baseCliId: cliId,
          supportedEfforts: effort !== null ? [effort] : null,
          supportsThinking: thinking,
          supportsFast: fast,
          hidden: cfg.hidden ?? false,
          deprecated: cfg.deprecated ?? false,
        });
      }
    }
  }
  return out;
}

const FAMILIES: ReadonlyArray<CursorFamilyConfig> = [
  // ─── Composer (Cursor's first-party) ───────────────────────────────
  {
    // Composer 2.5 is Cursor's first-party model line. expandFamily emits TWO
    // entries here — composer-2.5 (turn) and composer-2.5-fast (cheap, the
    // CLI default per `cursor-agent models`).
    family: 'composer',
    subfamily: 'composer',
    version: '2.5',
    contextWindow: 200_000,
    tier: 'turn',
    cliPrefix: 'composer-2.5',
    efforts: null,
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: false,
  },
  {
    family: 'composer',
    subfamily: 'composer',
    version: '2',
    contextWindow: 200_000,
    tier: 'turn',
    cliPrefix: 'composer-2',
    efforts: null,
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: false,
    deprecated: true,
  },
  {
    family: 'composer',
    subfamily: 'composer',
    version: '1.5',
    contextWindow: 200_000,
    tier: 'turn',
    cliPrefix: 'composer-1.5',
    efforts: null,
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: false,
    deprecated: true,
    hidden: true,
  },
  {
    family: 'composer',
    subfamily: 'composer',
    version: '1',
    contextWindow: 200_000,
    tier: 'turn',
    cliPrefix: 'composer-1',
    efforts: null,
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: false,
    deprecated: true,
    hidden: true,
  },

  // ─── Cursor Auto (routing) ─────────────────────────────────────────
  // NOTE: live probe shows --model auto is rejected by recent CLI builds
  // (paperclipai/paperclip#1357). Kept for picker affordance but flagged
  // deprecated so users see the warning.
  {
    family: 'cursor-auto',
    subfamily: 'auto',
    version: 'auto',
    contextWindow: 200_000,
    tier: 'cheap',
    cliPrefix: 'auto',
    efforts: null,
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: false,
    deprecated: true,
  },

  // ─── Claude — Opus 4.7 (new naming: claude-opus-4-7-{thinking}?-{effort}-{fast}?) ─
  {
    family: 'claude',
    subfamily: 'opus',
    version: '4.7',
    contextWindow: 1_000_000,
    tier: 'turn',
    cliPrefix: 'claude-opus-4-7',
    efforts: ['low', 'medium', 'high', 'extra-high', 'max'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: true,
  },
  // ─── Claude — Opus 4.6 (old naming: claude-4.6-opus-{effort}-{thinking}?-{fast}?) ─
  // Effort-suffix mapping for old-naming Claude families: only `high` and `max` exist.
  {
    family: 'claude',
    subfamily: 'opus',
    version: '4.6',
    contextWindow: 1_000_000,
    tier: 'turn',
    cliPrefix: 'claude-4.6-opus',
    efforts: ['high', 'max'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: true,
  },
  {
    family: 'claude',
    subfamily: 'opus',
    version: '4.5',
    contextWindow: 200_000,
    tier: 'turn',
    cliPrefix: 'claude-4.5-opus',
    efforts: ['high'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: true,
    deprecated: true,
  },

  // ─── Claude — Sonnet 4.6 (single-effort `medium`, thinking toggle) ─
  {
    family: 'claude',
    subfamily: 'sonnet',
    version: '4.6',
    contextWindow: 1_000_000,
    tier: 'turn',
    cliPrefix: 'claude-4.6-sonnet',
    efforts: ['medium'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: true,
  },
  {
    family: 'claude',
    subfamily: 'sonnet',
    version: '4.5',
    contextWindow: 200_000,
    tier: 'turn',
    cliPrefix: 'claude-4.5-sonnet',
    efforts: null,
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: false,
    deprecated: true,
  },

  // ─── GPT-5 (Cursor proxy) ──────────────────────────────────────────
  {
    family: 'gpt',
    subfamily: 'gpt',
    version: '5.5',
    contextWindow: 1_000_000,
    tier: 'turn',
    cliPrefix: 'gpt-5.5',
    efforts: ['minimal', 'low', 'medium', 'high', 'extra-high'],
    effortSuffix: XHIGH_AS_EXTRA_HIGH,
    supportsFast: true,
    supportsThinking: false,
  },
  {
    family: 'gpt',
    subfamily: 'gpt',
    version: '5.4',
    contextWindow: 1_000_000,
    tier: 'turn',
    cliPrefix: 'gpt-5.4',
    efforts: ['low', 'medium', 'high', 'extra-high'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: false,
  },
  {
    family: 'gpt',
    subfamily: 'gpt-mini',
    version: '5.4-mini',
    contextWindow: 400_000,
    tier: 'cheap',
    cliPrefix: 'gpt-5.4-mini',
    efforts: ['minimal', 'low', 'medium', 'high', 'extra-high'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: false,
  },
  {
    family: 'gpt',
    subfamily: 'gpt-nano',
    version: '5.4-nano',
    contextWindow: 400_000,
    tier: 'cheap',
    cliPrefix: 'gpt-5.4-nano',
    efforts: ['minimal', 'low', 'medium', 'high', 'extra-high'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: false,
    hidden: true,
  },
  {
    family: 'gpt',
    subfamily: 'gpt-codex',
    version: '5.3-codex',
    contextWindow: 400_000,
    tier: 'turn',
    cliPrefix: 'gpt-5.3-codex',
    efforts: ['low', 'medium', 'high', 'extra-high'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: false,
  },
  {
    family: 'gpt',
    subfamily: 'gpt-codex',
    version: '5.2-codex',
    contextWindow: 400_000,
    tier: 'turn',
    cliPrefix: 'gpt-5.2-codex',
    efforts: ['low', 'medium', 'high', 'extra-high'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: false,
    hidden: true,
  },
  {
    family: 'gpt',
    subfamily: 'gpt',
    version: '5.2',
    contextWindow: 400_000,
    tier: 'turn',
    cliPrefix: 'gpt-5.2',
    efforts: ['low', 'medium', 'high', 'extra-high'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: false,
    hidden: true,
  },
  {
    family: 'gpt',
    subfamily: 'gpt-codex-max',
    version: '5.1-codex-max',
    contextWindow: 400_000,
    tier: 'turn',
    cliPrefix: 'gpt-5.1-codex-max',
    efforts: ['low', 'medium', 'high', 'extra-high'],
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: true,
    supportsThinking: false,
    hidden: true,
  },

  // ─── Gemini ────────────────────────────────────────────────────────
  {
    family: 'gemini',
    subfamily: 'gemini',
    version: '3.1-pro',
    contextWindow: 1_000_000,
    tier: 'turn',
    cliPrefix: 'gemini-3.1-pro',
    efforts: null,
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: false,
  },

  // ─── xAI Grok ──────────────────────────────────────────────────────
  {
    family: 'grok',
    subfamily: 'grok',
    version: '4.3',
    contextWindow: 1_000_000,
    tier: 'turn',
    cliPrefix: 'grok-4.3',
    efforts: null,
    effortSuffix: XHIGH_AS_XHIGH,
    supportsFast: false,
    supportsThinking: false,
  },
];

// One row per CLI id, after exploding (effort × thinking × fast) per family.
export const CURSOR_MODELS: ReadonlyArray<ModelEntry> = FAMILIES.flatMap(expandFamily);
