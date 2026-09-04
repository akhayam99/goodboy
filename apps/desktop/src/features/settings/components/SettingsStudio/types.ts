import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';

export type SettingsScope = 'app' | 'workspace' | 'providers';

export type SettingsFocus = {
  readonly scope: SettingsScope;
  readonly section?: string;
  readonly provider?: ProviderId;
  readonly action?: ProviderLifecycleAction;
};
