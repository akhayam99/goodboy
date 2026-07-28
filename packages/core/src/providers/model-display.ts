import type { ModelDescriptor, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { MODEL_CATALOGS } from './catalogs';

const PROVIDER_PRIORITY: ReadonlyArray<ProviderId> = [
  'anthropic',
  'codex',
  'gemini',
  'cursor',
  'opencode',
  'openrouter',
];

const DESCRIPTOR_BY_ID: ReadonlyMap<string, ModelDescriptor> = (() => {
  const map = new Map<string, ModelDescriptor>();
  for (const provider of PROVIDER_PRIORITY) {
    for (const descriptor of PROVIDER_CAPABILITIES[provider].models) {
      if (!map.has(descriptor.id)) {
        map.set(descriptor.id, descriptor);
      }
      const model = MODEL_CATALOGS[provider].find((candidate) => candidate.key === descriptor.id);
      if (model == null) {
        continue;
      }
      switch (model.provider) {
        case 'anthropic':
        case 'gemini':
        case 'opencode':
        case 'openrouter':
          map.set(model.cliId, descriptor);
          break;
        case 'codex':
          for (const variant of model.variants) {
            map.set(variant.cliId, descriptor);
          }
          break;
        case 'cursor':
          for (const combo of model.combos) {
            map.set(combo.slug, descriptor);
          }
          break;
        default: {
          const exhaustive: never = model;
          throw new Error(`unknown catalog model: ${String(exhaustive)}`);
        }
      }
    }
  }
  return map;
})();

const PROVIDER_BY_MODEL: ReadonlyMap<string, ProviderId> = (() => {
  const map = new Map<string, ProviderId>();
  for (const provider of PROVIDER_PRIORITY) {
    for (const [id, descriptor] of DESCRIPTOR_BY_ID) {
      if (PROVIDER_CAPABILITIES[provider].models.includes(descriptor) && !map.has(id)) {
        map.set(id, provider);
      }
    }
  }
  return map;
})();

export const getModelDescriptor = (id: string): ModelDescriptor | null => {
  return DESCRIPTOR_BY_ID.get(id) ?? null;
};

export const getModelProvider = (id: string): ProviderId | null => {
  return PROVIDER_BY_MODEL.get(id) ?? null;
};
