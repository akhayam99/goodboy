import {
  MODEL_CATALOG,
  entryByCliId,
  listEntries,
  listVersions,
  resolveCursorEntry,
  type EffortLevel,
  type ModelEntry,
  type ModelFamily,
  type ModelSubfamily,
} from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';

// Picker state, parallel for all 3 providers. Anthropic + Codex ignore
// `thinking` and `fast` — those are Cursor-only modifiers baked into the cliId.
export interface PickerSelection {
  readonly family: ModelFamily;
  readonly subfamily: ModelSubfamily;
  readonly version: string;
  readonly effort: EffortLevel | null;
  readonly thinking: boolean;
  readonly fast: boolean;
}

// Reverse-engineer the picker state from a stored cliId so the picker can
// rehydrate after reload. Returns null when the cliId is unknown to the
// catalog (e.g. a model the user typed manually).
export function selectionFromCliId(
  provider: ProviderId,
  cliId: string,
  storedEffort: EffortLevel | null,
): PickerSelection | null {
  const entry = entryByCliId(provider, cliId);
  if (entry === null) return null;
  const effort =
    provider === 'cursor'
      ? (entry.supportedEfforts?.[0] ?? null)
      : (storedEffort ?? entry.supportedEfforts?.[1] ?? entry.supportedEfforts?.[0] ?? null);
  return {
    family: entry.family,
    subfamily: entry.subfamily,
    version: entry.version,
    effort,
    thinking: entry.supportsThinking,
    fast: entry.supportsFast,
  };
}

// Forward map: (provider + picker state) → cliId the CLI should be invoked
// with. For Anthropic + Codex the model id is the base; effort is passed
// separately downstream. For Cursor we resolve through the catalog because
// effort/thinking/fast are baked into the cliId string.
export function cliIdFromSelection(
  provider: ProviderId,
  selection: PickerSelection,
): string | null {
  if (provider === 'cursor') {
    return (
      resolveCursorEntry(selection.family, selection.subfamily, selection.version, selection)
        ?.baseCliId ?? null
    );
  }
  // Anthropic + Codex: look up the single (family, subfamily, version) entry.
  const entry = MODEL_CATALOG[provider].find(
    (e) =>
      e.family === selection.family &&
      e.subfamily === selection.subfamily &&
      e.version === selection.version,
  );
  return entry?.baseCliId ?? null;
}

// Group catalog entries for picker rendering: provider → family → subfamily
// → entry (with effort/thinking/fast as the leaf state). Hidden entries
// excluded unless explicitly requested.
export interface PickerGroup {
  readonly family: ModelFamily;
  readonly subfamilies: ReadonlyArray<{
    readonly subfamily: ModelSubfamily;
    readonly versions: ReadonlyArray<string>;
  }>;
}

export function pickerGroupsFor(provider: ProviderId): ReadonlyArray<PickerGroup> {
  const entries = listEntries(provider);
  const byFamily = new Map<ModelFamily, Map<ModelSubfamily, Set<string>>>();
  for (const e of entries) {
    let famMap = byFamily.get(e.family);
    if (!famMap) {
      famMap = new Map();
      byFamily.set(e.family, famMap);
    }
    let verSet = famMap.get(e.subfamily);
    if (!verSet) {
      verSet = new Set();
      famMap.set(e.subfamily, verSet);
    }
    verSet.add(e.version);
  }
  return [...byFamily.entries()].map(([family, subMap]) => ({
    family,
    subfamilies: [...subMap.entries()].map(([subfamily, verSet]) => ({
      subfamily,
      versions: listVersions(provider, family, subfamily),
    })),
  }));
}

// Click-to-cycle: given the currently-selected version inside a (family,
// subfamily) row, return the next one to select. Wraps newest→oldest→newest.
export function nextVersionForCycle(
  provider: ProviderId,
  family: ModelFamily,
  subfamily: ModelSubfamily,
  currentVersion: string,
): string | null {
  const versions = listVersions(provider, family, subfamily);
  if (versions.length === 0) return null;
  const idx = versions.indexOf(currentVersion);
  if (idx === -1) return versions[0] ?? null;
  return versions[(idx + 1) % versions.length] ?? null;
}

// Convenience: when the user clicks a family name (no version focus), select
// the latest version of that (family, subfamily).
export function latestVersionFor(
  provider: ProviderId,
  family: ModelFamily,
  subfamily: ModelSubfamily,
): string | null {
  const versions = listVersions(provider, family, subfamily);
  return versions[0] ?? null;
}

// Re-export the entry type so picker components can declare typed props
// without dipping into @goodboy/core directly.
export type { ModelEntry };
