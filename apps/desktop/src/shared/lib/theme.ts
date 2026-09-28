import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { STORAGE_KEYS } from './storage-keys';

export type Theme = 'dark' | 'light';

export type ThemePreference = Theme | 'system';

const STORAGE_KEY = STORAGE_KEYS.theme;
const LIGHT_QUERY = '(prefers-color-scheme: light)';
const SWITCHING_ATTRIBUTE = 'data-theme-switching';

const readStoredPreference = (): ThemePreference => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'system') {
      return raw;
    }
  } catch {}
  return 'dark';
};

const lightQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia(LIGHT_QUERY) : null;

export const resolveTheme = ({
  preference,
  systemIsLight,
}: {
  readonly preference: ThemePreference;
  readonly systemIsLight: boolean;
}): Theme => {
  if (preference === 'system') {
    return systemIsLight ? 'light' : 'dark';
  }
  return preference;
};

const listeners = new Set<() => void>();

export const getAppliedTheme = (): Theme =>
  document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

export const subscribeAppliedTheme = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useAppliedTheme = (): Theme =>
  useSyncExternalStore(subscribeAppliedTheme, getAppliedTheme);

const isApplied = ({ theme }: { readonly theme: Theme }): boolean => {
  const root = document.documentElement;
  return getAppliedTheme() === theme && root.classList.contains(theme);
};

export const applyDocumentTheme = ({ theme }: { readonly theme: Theme }): void => {
  if (isApplied({ theme })) {
    return;
  }
  const root = document.documentElement;
  root.setAttribute(SWITCHING_ATTRIBUTE, '');
  root.classList.remove(theme === 'light' ? 'dark' : 'light');
  root.classList.add(theme);
  root.style.colorScheme = theme;
  root.toggleAttribute('data-theme', theme === 'light');
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  }
  void window.getComputedStyle(document.body).opacity;
  window.setTimeout(() => root.removeAttribute(SWITCHING_ATTRIBUTE), 1);
  listeners.forEach((listener) => listener());
};

const resolveAndApply = ({ preference }: { readonly preference: ThemePreference }): void => {
  applyDocumentTheme({
    theme: resolveTheme({ preference, systemIsLight: lightQuery()?.matches === true }),
  });
};

type ThemeState = {
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
  readonly toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'dark',
  setPreference: (preference) => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {}
    resolveAndApply({ preference });
    if (get().preference !== preference) {
      set({ preference });
    }
  },
  toggleTheme: () => {
    get().setPreference(getAppliedTheme() === 'dark' ? 'light' : 'dark');
  },
}));

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

export const bootstrapTheme = (): (() => void) => {
  const preference = readStoredPreference();
  resolveAndApply({ preference });
  useThemeStore.setState({ preference });
  const query = lightQuery();
  const onSystemChange = () => {
    const current = useThemeStore.getState().preference;
    if (current !== 'system') {
      return;
    }
    resolveAndApply({ preference: current });
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !isThemePreference(event.newValue)) {
      return;
    }
    resolveAndApply({ preference: event.newValue });
    useThemeStore.setState({ preference: event.newValue });
  };
  window.addEventListener('storage', onStorage);
  query?.addEventListener('change', onSystemChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    query?.removeEventListener('change', onSystemChange);
  };
};
