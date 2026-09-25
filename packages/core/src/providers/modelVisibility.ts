import type { CatalogModel, ModelKey, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';

export type HiddenModels = Readonly<Partial<Record<ProviderId, ReadonlyArray<ModelKey>>>>;

type ProviderParams = {
  readonly provider: ProviderId;
};

type HiddenParams = ProviderParams & {
  readonly hidden: HiddenModels;
};

type KeyParams = HiddenParams & {
  readonly key: ModelKey;
};

type VisibleParams = HiddenParams & {
  readonly currentKey?: ModelKey | null;
};

type ToggleParams = HiddenParams & {
  readonly keys: ReadonlyArray<ModelKey>;
  readonly visible: boolean;
};

const PROVIDER_IDS = Object.keys(MODEL_CATALOGS).filter(
  (id): id is ProviderId => id in MODEL_CATALOGS,
);

const catalogOf = ({ provider }: ProviderParams): ReadonlyArray<CatalogModel> =>
  MODEL_CATALOGS[provider];

export const legacyHiddenModels = (): HiddenModels =>
  Object.fromEntries(
    PROVIDER_IDS.flatMap((provider) => {
      const keys = catalogOf({ provider })
        .filter((model) => model.legacy === true)
        .map((model) => model.key);
      return keys.length === 0 ? [] : [[provider, keys]];
    }),
  );

export const parseHiddenModels = (raw: string | null | undefined): HiddenModels => {
  if (raw == null) {
    return legacyHiddenModels();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return legacyHiddenModels();
    }
    return Object.fromEntries(
      PROVIDER_IDS.flatMap((provider) => {
        const value: unknown = Reflect.get(parsed, provider);
        if (!Array.isArray(value)) {
          return [];
        }
        const keys = value.filter((key): key is string => typeof key === 'string');
        return [[provider, keys]];
      }),
    );
  } catch {
    return legacyHiddenModels();
  }
};

export const isModelHidden = ({ provider, hidden, key }: KeyParams): boolean =>
  hidden[provider]?.includes(key) ?? false;

export const visibleCatalog = ({
  provider,
  hidden,
  currentKey,
}: VisibleParams): ReadonlyArray<CatalogModel> =>
  catalogOf({ provider }).filter(
    (model) => model.key === currentKey || !isModelHidden({ provider, hidden, key: model.key }),
  );

export const visibleModelCount = ({ provider, hidden }: HiddenParams): number =>
  visibleCatalog({ provider, hidden }).length;

export const withModelsVisible = ({
  provider,
  hidden,
  keys,
  visible,
}: ToggleParams): HiddenModels => {
  const current = hidden[provider] ?? [];
  const next = visible
    ? current.filter((key) => !keys.includes(key))
    : [...new Set([...current, ...keys])];
  const catalogKeys = catalogOf({ provider }).map((model) => model.key);
  if (next.filter((key) => catalogKeys.includes(key)).length >= catalogKeys.length) {
    return hidden;
  }
  return { ...hidden, [provider]: next };
};
