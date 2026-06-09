import type { ModelEffort, ProviderId, ProviderRegistryCapabilities } from '@goodboy/types';
import { CURSOR_MODELS } from './cursor/models';
import { CODEX_MODELS } from './codex/constants';
import { GEMINI_MODELS } from './gemini/constants';

const OPUS_EFFORT: ReadonlyArray<ModelEffort> = ['low', 'medium', 'high', 'extra-high', 'max'];
const SONNET_EFFORT: ReadonlyArray<ModelEffort> = ['low', 'medium', 'high'];

export const PROVIDER_CAPABILITIES: Readonly<Record<ProviderId, ProviderRegistryCapabilities>> = {
  anthropic: {
    models: [
      {
        id: 'claude-opus-4-8',
        tier: 'turn',
        contextWindow: 1_000_000,
        family: 'claude',
        subfamily: 'opus',
        label: 'Opus 4.8',
        variantLabel: '4.8',
        costTier: 'expensive',
        weight: 80,
        effort: OPUS_EFFORT,
      },
      {
        id: 'claude-fable-5',
        tier: 'turn',
        contextWindow: 1_000_000,
        family: 'claude',
        subfamily: 'fable',
        label: 'Fable 5',
        variantLabel: '5',
        costTier: 'expensive',
        weight: 90,
        effort: OPUS_EFFORT,
      },
      {
        id: 'claude-opus-4-7',
        tier: 'turn',
        contextWindow: 1_000_000,
        family: 'claude',
        subfamily: 'opus',
        label: 'Opus 4.7',
        variantLabel: '4.7',
        costTier: 'expensive',
        weight: 75,
        effort: OPUS_EFFORT,
      },
      {
        id: 'claude-opus-4-6',
        tier: 'turn',
        contextWindow: 200_000,
        family: 'claude',
        subfamily: 'opus',
        label: 'Opus 4.6',
        variantLabel: '4.6',
        costTier: 'expensive',
        weight: 60,
        effort: OPUS_EFFORT,
      },
      {
        id: 'claude-sonnet-4-6',
        tier: 'turn',
        contextWindow: 200_000,
        family: 'claude',
        subfamily: 'sonnet',
        label: 'Sonnet 4.6',
        variantLabel: '4.6',
        costTier: 'mid',
        weight: 15,
        effort: SONNET_EFFORT,
      },
      {
        id: 'claude-sonnet-4-5',
        tier: 'turn',
        contextWindow: 200_000,
        family: 'claude',
        subfamily: 'sonnet',
        label: 'Sonnet 4.5',
        variantLabel: '4.5',
        costTier: 'mid',
        weight: 14,
        effort: SONNET_EFFORT,
      },
      {
        id: 'claude-haiku-4-5',
        tier: 'cheap',
        contextWindow: 200_000,
        family: 'claude',
        subfamily: 'haiku',
        label: 'Haiku 4.5',
        variantLabel: '4.5',
        costTier: 'cheap',
        weight: 5,
        effort: null,
      },
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
  gemini: {
    models: GEMINI_MODELS,
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
