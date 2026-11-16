export type SettingsStudioScope = 'home' | 'app' | 'workspace';

export type SettingsPageScope = Exclude<SettingsStudioScope, 'home'>;

export type SettingsFlow = 'copy' | 'restore';

export type SettingsFocus = {
  readonly scope: SettingsStudioScope;
  readonly section?: string;
  readonly flow?: SettingsFlow;
  readonly row?: string;
};

export type SettingsScopeChange = {
  readonly scope: SettingsStudioScope;
  readonly section?: string;
};
