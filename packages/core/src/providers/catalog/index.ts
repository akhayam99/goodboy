import type { ProviderId } from '@goodboy/types';
import { ANTHROPIC_MODELS } from './anthropic';
import { CODEX_MODELS } from './codex';
import { CURSOR_MODELS } from './cursor';
import type { EffortLevel, ModelEntry, ModelFamily, ModelSelection, ModelSubfamily } from './types';

export type {
  EffortLevel,
  ModelEntry,
  ModelFamily,
  ModelSelection,
  ModelSubfamily,
  ModelTier,
} from './types';
export { ALL_EFFORTS } from './types';

// Single registry every UI consumer reads from. Provider order matters: the
// picker renders them left-to-right, so anthropic first keeps Claude on the
// far-left tab (matches existing UX + the user's mental default).
export const MODEL_CATALOG: Readonly<Record<ProviderId, ReadonlyArray<ModelEntry>>> = {
  anthropic: ANTHROPIC_MODELS,
  cursor: CURSOR_MODELS,
  codex: CODEX_MODELS,
};

// Picker iteration order for versions inside a (provider, subfamily) row.
// Higher = newer. Drives "click family → latest" + "re-click → previous"
// cycling. Designed to handle dotted versions (4.7) and dashed ones (5.4-mini,
// 3.1-pro) without a per-pattern parser.
export function versionWeight(version: string): number {
  // Strip non-numeric suffixes after the first dot/dash run of digits.
  const m = version.match(/^(\d+)(?:\.(\d+))?/);
  if (!m) return 0;
  const major = Number(m[1]);
  const minor = Number(m[2] ?? '0');
  return major * 1000 + minor;
}

// Picker section ordering. Lower = rendered first inside the provider tab.
const FAMILY_ORDER: Record<ModelFamily, number> = {
  composer: 0,
  claude: 1,
  gpt: 2,
  gemini: 3,
  grok: 4,
  'cursor-auto': 99,
};

// Subfamily ordering inside a family (e.g. Opus first then Sonnet then Haiku).
const SUBFAMILY_ORDER: Record<ModelSubfamily, number> = {
  opus: 0,
  sonnet: 1,
  haiku: 2,
  gpt: 0,
  'gpt-codex': 1,
  'gpt-codex-max': 2,
  'gpt-codex-mini': 3,
  'gpt-codex-spark': 4,
  'gpt-mini': 5,
  'gpt-nano': 6,
  'gpt-pro': 7,
  composer: 0,
  gemini: 0,
  grok: 0,
  auto: 0,
};

export function familyOrder(family: ModelFamily): number {
  return FAMILY_ORDER[family] ?? 50;
}

export function subfamilyOrder(subfamily: ModelSubfamily): number {
  return SUBFAMILY_ORDER[subfamily] ?? 50;
}

// Returns all entries for a provider, deduped and sorted (family → subfamily
// → version desc → effort asc → modifiers off-first). Hidden entries are
// excluded by default — pass `{ includeHidden: true }` for admin/debug views.
export function listEntries(
  provider: ProviderId,
  opts: { includeHidden?: boolean } = {},
): ReadonlyArray<ModelEntry> {
  const all = MODEL_CATALOG[provider];
  const filtered = opts.includeHidden ? all : all.filter((e) => !e.hidden);
  return [...filtered].sort((a, b) => {
    const fam = familyOrder(a.family) - familyOrder(b.family);
    if (fam !== 0) return fam;
    const sub = subfamilyOrder(a.subfamily) - subfamilyOrder(b.subfamily);
    if (sub !== 0) return sub;
    const ver = versionWeight(b.version) - versionWeight(a.version);
    if (ver !== 0) return ver;
    const tCmp = Number(a.supportsThinking) - Number(b.supportsThinking);
    if (tCmp !== 0) return tCmp;
    return Number(a.supportsFast) - Number(b.supportsFast);
  });
}

// Lookup the entry for a CLI id. Used when rehydrating a persisted picker
// state from a stored cliId string back to its structured metadata.
export function entryByCliId(provider: ProviderId, cliId: string): ModelEntry | null {
  const all = MODEL_CATALOG[provider];
  return all.find((e) => e.baseCliId === cliId) ?? null;
}

// For Cursor: given the user's picker choice (family/subfamily/version +
// effort + thinking + fast), find the matching entry. Returns null if no
// catalog row exists for that combination (e.g. effort=max on a sonnet that
// only ships effort=medium).
export function resolveCursorEntry(
  family: ModelFamily,
  subfamily: ModelSubfamily,
  version: string,
  selection: ModelSelection,
): ModelEntry | null {
  const all = MODEL_CATALOG.cursor;
  return (
    all.find(
      (e) =>
        e.family === family &&
        e.subfamily === subfamily &&
        e.version === version &&
        (e.supportedEfforts?.[0] ?? null) === selection.effort &&
        e.supportsThinking === selection.thinking &&
        e.supportsFast === selection.fast,
    ) ?? null
  );
}

// Picker query: for a given (provider, family, subfamily), return the
// distinct versions available. Sorted newest-first by versionWeight.
export function listVersions(
  provider: ProviderId,
  family: ModelFamily,
  subfamily: ModelSubfamily,
): ReadonlyArray<string> {
  const seen = new Set<string>();
  for (const e of MODEL_CATALOG[provider]) {
    if (e.hidden) continue;
    if (e.family !== family || e.subfamily !== subfamily) continue;
    seen.add(e.version);
  }
  return [...seen].sort((a, b) => versionWeight(b) - versionWeight(a));
}

// For a given (provider, family, subfamily, version), enumerate effort levels
// the user can pick. Anthropic + Codex: read off the single entry. Cursor:
// union of effort levels across all entries matching that (family, version).
export function listEfforts(
  provider: ProviderId,
  family: ModelFamily,
  subfamily: ModelSubfamily,
  version: string,
): ReadonlyArray<EffortLevel> | null {
  const matches = MODEL_CATALOG[provider].filter(
    (e) => !e.hidden && e.family === family && e.subfamily === subfamily && e.version === version,
  );
  if (matches.length === 0) return null;
  const efforts = new Set<EffortLevel>();
  for (const e of matches) {
    for (const lvl of e.supportedEfforts ?? []) efforts.add(lvl);
  }
  if (efforts.size === 0) return null;
  return EFFORT_ORDER.filter((e) => efforts.has(e));
}

const EFFORT_ORDER: ReadonlyArray<EffortLevel> = [
  'minimal',
  'low',
  'medium',
  'high',
  'extra-high',
  'max',
];
