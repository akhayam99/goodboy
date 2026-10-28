import type { ProviderId, ProviderRegistryCapabilities } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { catalogDescriptor } from './catalogDescriptor';
import { defaultTurnModel } from './defaultTurnModel';

export const PROVIDER_CAPABILITIES: Readonly<Record<ProviderId, ProviderRegistryCapabilities>> = {
  anthropic: {
    models: MODEL_CATALOGS.anthropic.map((model) => catalogDescriptor({ model })),
  },
  cursor: {
    models: MODEL_CATALOGS.cursor.map((model) => catalogDescriptor({ model })),
  },
  codex: {
    models: MODEL_CATALOGS.codex.map((model) => catalogDescriptor({ model })),
  },
  gemini: {
    models: MODEL_CATALOGS.gemini.map((model) => catalogDescriptor({ model })),
  },
  copilot: {
    models: MODEL_CATALOGS.copilot.map((model) => catalogDescriptor({ model })),
  },
  opencode: {
    models: MODEL_CATALOGS.opencode.map((model) => catalogDescriptor({ model })),
  },
  openrouter: {
    models: MODEL_CATALOGS.openrouter.map((model) => catalogDescriptor({ model })),
  },
  moonshot: {
    models: MODEL_CATALOGS.moonshot.map((model) => catalogDescriptor({ model })),
  },
};

type Params = {
  readonly id: ProviderId;
};

export const getCapabilities = ({ id }: Params): ProviderRegistryCapabilities => {
  return PROVIDER_CAPABILITIES[id];
};

export const getDefaultTurnModel = ({ id }: Params): string =>
  defaultTurnModel({ provider: id }).key;
