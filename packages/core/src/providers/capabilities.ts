import type { ModelTier, ProviderId, ProviderRegistryCapabilities } from '@goodboy/types';
import { MODEL_CATALOG } from './catalog';

// Back-compat shim: ProviderRegistryCapabilities still exposes a flat
// ModelTier[] for consumers (sidebar context-window lookup, config selects,
// ChatInput model dropdown). The list is derived from the structured
// MODEL_CATALOG so we maintain a single source of truth.
function toModelTiers(provider: ProviderId): ReadonlyArray<ModelTier> {
  const seen = new Set<string>();
  const out: ModelTier[] = [];
  for (const entry of MODEL_CATALOG[provider]) {
    if (entry.baseCliId === null || seen.has(entry.baseCliId)) continue;
    seen.add(entry.baseCliId);
    out.push({
      id: entry.baseCliId,
      tier: entry.tier,
      contextWindow: entry.contextWindow,
    });
  }
  return out;
}

export const PROVIDER_CAPABILITIES: Readonly<Record<ProviderId, ProviderRegistryCapabilities>> = {
  anthropic: {
    models: toModelTiers('anthropic'),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  cursor: {
    models: toModelTiers('cursor'),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  codex: {
    models: toModelTiers('codex'),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
};

export function getCapabilities(id: ProviderId): ProviderRegistryCapabilities {
  return PROVIDER_CAPABILITIES[id];
}

export function getDefaultTurnModel(id: ProviderId): string {
  const caps = PROVIDER_CAPABILITIES[id];
  return caps.models.find((m) => m.tier === 'turn')?.id ?? caps.models[0]!.id;
}
