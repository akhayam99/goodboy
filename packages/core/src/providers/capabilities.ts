import type { ProviderId, ProviderRegistryCapabilities } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { catalogDescriptor } from './catalogDescriptor';
import { GEMINI_DEFAULT_MODEL } from './gemini/constants';

export const PROVIDER_CAPABILITIES: Readonly<Record<ProviderId, ProviderRegistryCapabilities>> = {
  anthropic: {
    models: MODEL_CATALOGS.anthropic.map((model) => catalogDescriptor({ model })),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  cursor: {
    models: MODEL_CATALOGS.cursor.map((model) => catalogDescriptor({ model })),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  codex: {
    models: MODEL_CATALOGS.codex.map((model) => catalogDescriptor({ model })),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  gemini: {
    models: MODEL_CATALOGS.gemini.map((model) => catalogDescriptor({ model })),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  opencode: {
    models: MODEL_CATALOGS.opencode.map((model) => catalogDescriptor({ model })),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  openrouter: {
    models: MODEL_CATALOGS.openrouter.map((model) => catalogDescriptor({ model })),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: true,
  },
  moonshot: {
    models: MODEL_CATALOGS.moonshot.map((model) => catalogDescriptor({ model })),
    supportsTools: true,
    supportsStream: true,
    supportsCheapModel: false,
  },
};

type Params = {
  readonly id: ProviderId;
};

export const getCapabilities = ({ id }: Params): ProviderRegistryCapabilities => {
  return PROVIDER_CAPABILITIES[id];
};

export const getDefaultTurnModel = ({ id }: Params): string => {
  if (id === 'gemini') {
    return GEMINI_DEFAULT_MODEL;
  }
  const caps = PROVIDER_CAPABILITIES[id];
  return caps.models.find((model) => model.tier === 'turn')?.id ?? caps.models[0]!.id;
};
