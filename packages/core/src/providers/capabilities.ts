import type { ProviderId, ProviderRegistryCapabilities } from '@kay-am/types';
import { CURSOR_MODELS } from './cursor/models';
import { CODEX_MODELS } from './codex/constants';

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
    // claude CLI headless mode accepts images via --input-format stream-json
    // (content-block array on stdin). See turn.rs `build_provider_cli_args`.
    supportsImages: true,
  },
  cursor: {
    models: CURSOR_MODELS,
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
    // cursor-agent CLI -p mode is text-only.
    supportsImages: false,
  },
  codex: {
    models: CODEX_MODELS,
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
    // codex exec --json takes a text-only prompt arg.
    supportsImages: false,
  },
};

export function getCapabilities(id: ProviderId): ProviderRegistryCapabilities {
  return PROVIDER_CAPABILITIES[id];
}

export function getDefaultTurnModel(id: ProviderId): string {
  const caps = PROVIDER_CAPABILITIES[id];
  return caps.models.find((m) => m.tier === 'turn')?.id ?? caps.models[0]!.id;
}
