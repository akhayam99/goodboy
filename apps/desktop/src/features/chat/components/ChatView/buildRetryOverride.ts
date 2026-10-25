import type { ProviderId, TurnProviderOverride } from '@goodboy/types';

type Params = {
  readonly provider?: ProviderId;
  readonly model?: string;
};

export const buildRetryOverride = ({
  provider,
  model,
}: Params): TurnProviderOverride | undefined => {
  if (provider == null) {
    return undefined;
  }
  return {
    providerId: provider,
    ...(model != null ? { model } : {}),
  };
};
