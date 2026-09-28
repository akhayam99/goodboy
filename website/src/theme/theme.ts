import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'goodboy-site:theme';

const SYSTEM_DARK = '(prefers-color-scheme: dark)';

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';

const readStored = (): Theme | null => {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
};

const systemTheme = (): Theme => (window.matchMedia(SYSTEM_DARK).matches ? 'dark' : 'light');

const currentTheme = (): Theme => {
  const value = document.documentElement.getAttribute('data-theme');
  return isTheme(value) ? value : systemTheme();
};

type ApplyParams = {
  readonly theme: Theme;
};

const applyTheme = ({ theme }: ApplyParams) => {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
};

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const media = window.matchMedia(SYSTEM_DARK);
  const onSystem = () => {
    if (readStored() !== null) {
      return;
    }
    applyTheme({ theme: systemTheme() });
  };
  media.addEventListener('change', onSystem);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', onSystem);
  };
};

export const useTheme = (): Theme => useSyncExternalStore(subscribe, currentTheme, () => 'light');

export const setTheme = ({ theme }: ApplyParams) => {
  applyTheme({ theme });
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
};
