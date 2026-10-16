import { MODEL_CATALOGS } from '@goodboy/core';
import { modelLabel } from '../chat/utils/chat-constants';
import type { ModelKey, ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
};

export const chatModelLabel = ({ provider, model }: Params): string => {
  const catalog: ReadonlyArray<{ readonly key: string; readonly label: string }> =
    MODEL_CATALOGS[provider];
  return catalog.find((entry) => entry.key === model)?.label ?? modelLabel(model, provider);
};
