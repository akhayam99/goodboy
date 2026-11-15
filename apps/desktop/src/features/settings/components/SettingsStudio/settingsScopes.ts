import type { SettingsPageScope } from '../../settingsFocus';

type Params = {
  readonly scope: SettingsPageScope;
  readonly hasWorkspace: boolean;
};

export const settingsScopeAvailable = ({ scope, hasWorkspace }: Params): boolean =>
  scope === 'app' || hasWorkspace;
