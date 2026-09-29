import type { ModelDescriptor, ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from './capabilities';
import { MODEL_CATALOGS } from './catalogs';

const PROVIDER_RANK: Readonly<Record<ProviderId, number>> = {
  anthropic: 0,
  codex: 1,
  gemini: 2,
  opencode: 3,
  moonshot: 4,
  cursor: 5,
  openrouter: 6,
};

const PROVIDER_PRIORITY: ReadonlyArray<ProviderId> = (
  Object.keys(PROVIDER_RANK) as ProviderId[]
).sort((a, b) => PROVIDER_RANK[a] - PROVIDER_RANK[b]);

const descriptorsOf = ({ provider }: { readonly provider: ProviderId }) => {
  const map = new Map<string, ModelDescriptor>();
  const set = ({
    key,
    descriptor,
  }: {
    readonly key: string;
    readonly descriptor: ModelDescriptor;
  }) => {
    if (!map.has(key)) {
      map.set(key, descriptor);
    }
  };
  for (const descriptor of PROVIDER_CAPABILITIES[provider].models) {
    set({ key: descriptor.id, descriptor });
    const model = MODEL_CATALOGS[provider].find((candidate) => candidate.key === descriptor.id);
    if (model == null) {
      continue;
    }
    switch (model.provider) {
      case 'anthropic':
      case 'gemini':
      case 'opencode':
      case 'openrouter':
      case 'moonshot':
        set({ key: model.cliId, descriptor });
        break;
      case 'codex':
        for (const variant of model.variants) {
          set({ key: variant.cliId, descriptor });
        }
        break;
      case 'cursor':
        for (const combo of model.combos) {
          set({ key: combo.slug, descriptor });
        }
        break;
      default: {
        const exhaustive: never = model;
        throw new Error(`unknown catalog model: ${String(exhaustive)}`);
      }
    }
  }
  return map;
};

const DESCRIPTOR_BY_PROVIDER: ReadonlyMap<
  ProviderId,
  ReadonlyMap<string, ModelDescriptor>
> = new Map(PROVIDER_PRIORITY.map((provider) => [provider, descriptorsOf({ provider })]));

const DESCRIPTOR_BY_ID: ReadonlyMap<string, ModelDescriptor> = (() => {
  const map = new Map<string, ModelDescriptor>();
  for (const provider of PROVIDER_PRIORITY) {
    for (const [id, descriptor] of DESCRIPTOR_BY_PROVIDER.get(provider) ?? []) {
      if (!map.has(id)) {
        map.set(id, descriptor);
      }
    }
  }
  return map;
})();

const PROVIDER_BY_MODEL: ReadonlyMap<string, ProviderId> = (() => {
  const map = new Map<string, ProviderId>();
  for (const provider of PROVIDER_PRIORITY) {
    for (const id of DESCRIPTOR_BY_PROVIDER.get(provider)?.keys() ?? []) {
      if (!map.has(id)) {
        map.set(id, provider);
      }
    }
  }
  return map;
})();

type GetModelDescriptorParams = {
  readonly id: string;
  readonly provider?: ProviderId | null;
};

export const getModelDescriptor = ({
  id,
  provider = null,
}: GetModelDescriptorParams): ModelDescriptor | null => {
  if (provider !== null) {
    const scoped = DESCRIPTOR_BY_PROVIDER.get(provider)?.get(id);
    if (scoped !== undefined) {
      return scoped;
    }
  }
  return DESCRIPTOR_BY_ID.get(id) ?? null;
};

export const getModelProvider = (id: string): ProviderId | null => {
  return PROVIDER_BY_MODEL.get(id) ?? null;
};
