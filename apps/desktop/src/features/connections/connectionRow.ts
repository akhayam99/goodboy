import type { Tone } from '@goodboy/ui';
import type { IntegrationGlyphProvider } from '../../shared/components/IntegrationGlyph';
import type { SettingsScopeChange } from '../settings/settingsFocus';

export type ConnectionRowStatus = {
  readonly tone: Tone;
  readonly label: string;
};

export type ConnectionTarget =
  | { readonly kind: 'settings'; readonly change: SettingsScopeChange }
  | { readonly kind: 'tool'; readonly tool: IntegrationGlyphProvider };

export type ConnectionRow = {
  readonly key: string;
  readonly label: string;
  readonly status: ConnectionRowStatus | null;
  readonly target: ConnectionTarget;
};
