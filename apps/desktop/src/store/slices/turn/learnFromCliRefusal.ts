import { catalogModelForId } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly providerId: ProviderId;
  readonly model: string;
  readonly message: string;
};

export const learnFromCliRefusal = ({ get, providerId, model, message }: Params): void => {
  const failure = classifyProviderError({ message });
  if (failure.kind !== 'cli_too_old') {
    return;
  }
  const modelKey = catalogModelForId({ provider: providerId, modelId: model })?.key;
  if (modelKey === undefined) {
    return;
  }
  void get()
    .learnCliRequirement({
      providerId,
      modelKey,
      requiredVersion: failure.requiredVersion,
      installedVersion: failure.installedVersion,
    })
    .catch(() => undefined);
};
