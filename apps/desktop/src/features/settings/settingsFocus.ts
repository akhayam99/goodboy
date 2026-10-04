import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../integrations/components/IntegrationGlyph';

export type SettingsStudioScope = 'home' | 'app' | 'workspace' | 'providers' | 'tools';

export type SettingsPageScope = Exclude<SettingsStudioScope, 'home'>;

export type SettingsFlow = 'copy' | 'restore';

export type SettingsFocus = {
  readonly scope: SettingsStudioScope;
  readonly section?: string;
  readonly tool?: IntegrationGlyphProvider;
  readonly provider?: ProviderId;
  readonly action?: ProviderLifecycleAction;
  readonly flow?: SettingsFlow;
};

export type SettingsScopeChange = {
  readonly scope: SettingsStudioScope;
  readonly section?: string;
  readonly tool?: IntegrationGlyphProvider;
  readonly provider?: ProviderId;
};
