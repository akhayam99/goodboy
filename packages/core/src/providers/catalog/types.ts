import type { ProviderId } from '@goodboy/types';

// The six effort levels we expose in the picker. "minimal" exists only on
// Codex; "max" only on Claude Opus. Picker masks the unsupported ones per
// entry via `supportedEfforts`. We stay on the user-facing canonical name
// 'extra-high' (rather than Codex's wire format 'xhigh') so it matches the
// long-standing DB enum in packages/types/workspace.ts and avoids a migration.
export type EffortLevel = 'minimal' | 'low' | 'medium' | 'high' | 'extra-high' | 'max';

export const ALL_EFFORTS: ReadonlyArray<EffortLevel> = [
  'minimal',
  'low',
  'medium',
  'high',
  'extra-high',
  'max',
];

// Coarse family for picker grouping. Subfamilies (e.g. opus vs sonnet inside
// claude) live on the entry itself — the family alone drives the section
// header in the picker.
export type ModelFamily = 'claude' | 'gpt' | 'composer' | 'cursor-auto' | 'gemini' | 'grok';

// Sub-classification inside a family. Drives the row label inside the picker
// (e.g. "Opus" / "Sonnet" inside Claude; "Codex" / "Mini" inside GPT).
export type ModelSubfamily =
  | 'opus'
  | 'sonnet'
  | 'haiku'
  | 'gpt'
  | 'gpt-codex'
  | 'gpt-codex-max'
  | 'gpt-codex-mini'
  | 'gpt-codex-spark'
  | 'gpt-mini'
  | 'gpt-nano'
  | 'gpt-pro'
  | 'composer'
  | 'gemini'
  | 'grok'
  | 'auto';

export type ModelTier = 'turn' | 'cheap';

// One row in the unified catalog. Every CLI id the user can run resolves to
// exactly one entry; the picker walks (family, subfamily, version) and then
// applies effort + modifiers to recover a concrete `cliId` via `resolveCliId`.
export interface ModelEntry {
  readonly provider: ProviderId;
  readonly family: ModelFamily;
  readonly subfamily: ModelSubfamily;
  // Display version, e.g. "4.7", "5.5", "2.5", "3.1-pro". Sortable by `versionWeight`.
  readonly version: string;
  readonly contextWindow: number;
  readonly tier: ModelTier;
  // Provider-specific CLI flag for the BASE model (without effort/modifiers).
  // Anthropic + Codex pass effort separately; for Cursor this is the
  // "no-modifier" cliId or null when only effort-suffixed variants exist.
  readonly baseCliId: string | null;
  // Effort levels the CLI actually accepts for this entry. null = no effort
  // axis (e.g. Haiku, Composer, auto).
  readonly supportedEfforts: ReadonlyArray<EffortLevel> | null;
  // Cursor-only: extended-thinking mode toggle.
  readonly supportsThinking: boolean;
  // Cursor-only: fast-sampling research preview (6× pricing).
  readonly supportsFast: boolean;
  // Hide from picker by default (deprecated, niche, ChatGPT-Pro-only, etc.).
  readonly hidden: boolean;
  readonly deprecated: boolean;
}

// Snapshot of the user's current picker state for one chat. Resolves to a
// concrete CLI flag via `resolveCliId(entry, selection)`.
export interface ModelSelection {
  readonly effort: EffortLevel | null;
  readonly thinking: boolean;
  readonly fast: boolean;
}
