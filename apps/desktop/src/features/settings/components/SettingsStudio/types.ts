import type { ReactNode } from 'react';
import type { ProviderId, ProviderLifecycleAction } from '@goodboy/types';

import type { IntegrationGlyphProvider } from '../../../integrations/components/IntegrationGlyph';

export type SettingsStudioScope = 'app' | 'workspace' | 'providers' | 'tools';

export type SettingsFocus = {
  readonly scope: SettingsStudioScope;
  readonly section?: string;
  readonly tool?: IntegrationGlyphProvider;
  readonly provider?: ProviderId;
  readonly action?: ProviderLifecycleAction;
};

export type SettingsScopeChange = {
  readonly scope: SettingsStudioScope;
  readonly section?: string;
};

export type ScopeFrameParts = {
  readonly nested: ReactNode;
  readonly detail: ReactNode;
};

export type ScopeFrame = (parts: ScopeFrameParts) => ReactNode;
