import { catalogModelForId } from '@goodboy/core/providers';
import type { ProviderId } from '@goodboy/types';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import { accountIdOf } from '../providers/accountIdOf';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly providerId: ProviderId;
  readonly model: string;
  readonly message: string;
};

export const learnFromCliRefusal = ({ get, providerId, model, message }: Params): void => {
  const failure = classifyProviderError({ message });
  const isUnavailable =
    failure.kind === 'model_not_available' && failure.action === 'choose_supported_model';
  if (failure.kind !== 'cli_too_old' && !isUnavailable) {
    return;
  }
  const modelKey = catalogModelForId({ provider: providerId, modelId: model })?.key;
  if (modelKey === undefined) {
    return;
  }
  if (failure.kind !== 'cli_too_old') {
    void get()
      .learnModelUnavailable({
        providerId,
        accountId: accountIdOf({ providers: get().providers, providerId }),
        modelKey,
      })
      .catch((error: unknown) => console.warn('remembering an unavailable model failed', error));
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
