import type { Tone } from '@goodboy/ui';
import type { SettingsScopeChange } from '../settings/settingsFocus';

export type ConnectionRowStatus = {
  readonly tone: Tone;
  readonly label: string;
};

export type ConnectionRow = {
  readonly key: string;
  readonly label: string;
  readonly status: ConnectionRowStatus | null;
  readonly target: SettingsScopeChange;
};
