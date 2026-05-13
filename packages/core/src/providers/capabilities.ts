import type { ProviderId, ProviderRegistryCapabilities } from '@kay-am/types';
import { CURSOR_MODELS } from './cursor/models';
import { CODEX_MODELS } from './codex/constants';
import { OPENCODE_MODELS } from './opencode/models';

export const PROVIDER_CAPABILITIES: Readonly<Record<ProviderId, ProviderRegistryCapabilities>> = {
  anthropic: {
    models: [
      { id: 'claude-opus-4-7', tier: 'turn', contextWindow: 1_000_000 },
      { id: 'claude-opus-4-6', tier: 'turn', contextWindow: 200_000 },
      { id: 'claude-sonnet-4-6', tier: 'turn', contextWindow: 200_000 },
      { id: 'claude-sonnet-4-5', tier: 'turn', contextWindow: 200_000 },
      { id: 'claude-haiku-4-5', tier: 'cheap', contextWindow: 200_000 },
    ],
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  cursor: {
    models: CURSOR_MODELS,
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  codex: {
    models: CODEX_MODELS,
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  opencode: {
    models: OPENCODE_MODELS,
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
