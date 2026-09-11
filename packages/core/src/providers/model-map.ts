import type { ModelSelection, ProviderId } from '@goodboy/types';
import { defaultModelSelection } from './defaultModelSelection';
import { MODEL_CATALOGS } from './catalogs';
import { parseLegacyId } from './parseLegacyId';
import { remapModelSelection } from './remapModelSelection';
import { selectionFromCliId } from './selectionFromCliId';

type Params = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const PROVIDERS = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] satisfies ReadonlyArray<ProviderId>;

type Expect<T extends true> = T;
type ProvidersAreTotal =
  Exclude<ProviderId, (typeof PROVIDERS)[number]> extends never ? true : false;
type _ProvidersTotalCheck = Expect<ProvidersAreTotal>;

export const matchModelSelectionForProvider = ({
  provider,
  modelId,
}: Params): ModelSelection | null => {
  const keyed = MODEL_CATALOGS[provider].find((model) => model.key === modelId);
  if (keyed != null) {
    return { key: keyed.key };
  }
  const direct =
    selectionFromCliId({ provider, id: modelId }) ?? parseLegacyId({ provider, id: modelId });
  if (direct != null) {
    return direct;
  }
  for (const sourceProvider of PROVIDERS) {
    if (sourceProvider === provider) {
      continue;
    }
    const source =
      selectionFromCliId({ provider: sourceProvider, id: modelId }) ??
      parseLegacyId({ provider: sourceProvider, id: modelId });
    if (source == null) {
      continue;
    }
    const remapped = remapModelSelection({
      sourceProvider,
      targetProvider: provider,
      selection: source,
    });
    return remapped.selection;
  }
  return null;
};

export const resolveModelSelectionForProvider = ({ provider, modelId }: Params): ModelSelection =>
  matchModelSelectionForProvider({ provider, modelId }) ?? defaultModelSelection({ provider });

export const resolveModelForProvider = ({ provider, modelId }: Params): string =>
  resolveModelSelectionForProvider({ provider, modelId }).key;
