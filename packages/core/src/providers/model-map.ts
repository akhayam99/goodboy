import type { ProviderId } from '@goodboy/types';
import { defaultModelSelection } from './defaultModelSelection';
import { MODEL_CATALOGS } from './catalogs';
import { parseLegacyId } from './parseLegacyId';
import { remapModelSelection } from './remapModelSelection';
import { selectionFromCliId } from './selectionFromCliId';

type Params = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

const PROVIDERS = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] satisfies ReadonlyArray<ProviderId>;

export const resolveModelForProvider = ({ provider, modelId }: Params): string => {
  const keyed = MODEL_CATALOGS[provider].find((model) => model.key === modelId);
  if (keyed != null) {
    return keyed.key;
  }
  const direct =
    selectionFromCliId({ provider, id: modelId }) ?? parseLegacyId({ provider, id: modelId });
  if (direct != null) {
    return direct.key;
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
    return remapped.selection.key;
  }
  return defaultModelSelection({ provider }).key;
};
