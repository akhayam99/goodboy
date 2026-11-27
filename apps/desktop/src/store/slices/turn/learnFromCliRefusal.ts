import { catalogModelForId } from '@goodboy/core/providers';
import type { ProviderId } from '@goodboy/types';
import { classifyProviderError } from '../../../features/chat/classifyProviderError';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly providerId: ProviderId;
  readonly accountId: string;
  readonly plan: string | null;
  readonly model: string;
  readonly message: string;
  readonly nowMs?: number;
};

export const learnFromCliRefusal = ({
  get,
  providerId,
  accountId,
  plan,
  model,
  message,
  nowMs = Date.now(),
}: Params): void => {
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
        accountId,
        modelKey,
        plan,
        source: 'refused',
        checkedAt: nowMs,
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
