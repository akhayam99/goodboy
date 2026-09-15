import type { ProviderId } from '@goodboy/types';
import { matchModelSelectionForProvider } from './model-map';

type Params = {
  readonly provider: ProviderId;
  readonly modelId: string;
};

export const modelCatalogKey = ({ provider, modelId }: Params): string | null =>
  matchModelSelectionForProvider({ provider, modelId })?.key ?? null;
