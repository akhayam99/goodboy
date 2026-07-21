import type { ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { CURSOR_AUTO_MODEL } from './cursor/models';

export const getCheapModel = (providerId: ProviderId): string => {
  if (providerId === 'cursor') {
    return CURSOR_AUTO_MODEL;
  }
  const caps = PROVIDER_CAPABILITIES[providerId];
  return caps.models.find((model) => model.tier === 'cheap')?.id ?? caps.models[0]!.id;
};

export const getDefaultBinary = (providerId: ProviderId): string => {
  switch (providerId) {
    case 'anthropic':
      return 'claude';
    case 'cursor':
      return 'cursor-agent';
    case 'codex':
      return 'codex';
    case 'gemini':
      return 'gemini';
    default: {
      const _exhaustive: never = providerId;
      throw new Error(`unknown provider: ${_exhaustive}`);
    }
  }
};
