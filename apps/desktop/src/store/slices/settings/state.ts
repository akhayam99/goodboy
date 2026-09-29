export type SettingsState = {
  readonly settings: Readonly<Record<string, string>>;
};

export const settingsInitialState: SettingsState = {
  settings: {},
};
