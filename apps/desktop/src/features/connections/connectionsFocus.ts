import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';

export type ConnectionsFocus = {
  readonly provider: ProviderId;
  readonly action?: ProviderLifecycleAction;
  readonly section?: string;
};
