const LAST_SETTINGS_PAGE_KEY = 'goodboy:settings-last-page:v1';

export const readLastSettingsPage = (): string | null => {
  try {
    return localStorage.getItem(LAST_SETTINGS_PAGE_KEY);
  } catch {
    return null;
  }
};

export const writeLastSettingsPage = ({ key }: { readonly key: string }): void => {
  try {
    localStorage.setItem(LAST_SETTINGS_PAGE_KEY, key);
  } catch {
    return;
  }
};
