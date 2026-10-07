import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { STORAGE_KEYS, persistedPref } from './storage-keys';

export type Theme = 'dark' | 'light';

export type ThemePreference = Theme | 'system';

const STORAGE_KEY = STORAGE_KEYS.theme;
const LIGHT_QUERY = '(prefers-color-scheme: light)';
const SWITCHING_ATTRIBUTE = 'data-theme-switching';
const RELEASE_GUARD_MS = 120;

const themePref = persistedPref<ThemePreference>({
  key: STORAGE_KEY,
  parse: (raw) => (raw === 'light' || raw === 'system' ? raw : 'dark'),
  serialize: (preference) => preference,
  fallback: 'dark',
});

const readStoredPreference = themePref.read;

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

const classNameFor = ({
  root,
  theme,
}: {
  readonly root: HTMLElement;
  readonly theme: Theme;
}): string =>
  [...Array.from(root.classList).filter((name) => name !== 'light' && name !== 'dark'), theme].join(
    ' ',
  );

const writeDataTheme = ({
  root,
  theme,
}: {
  readonly root: HTMLElement;
  readonly theme: Theme;
}): void => {
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
    return;
  }
  root.removeAttribute('data-theme');
};

const swapDocumentTheme = ({ theme }: { readonly theme: Theme }): void => {
  const root = document.documentElement;
  root.className = classNameFor({ root, theme });
  root.style.colorScheme = theme;
  writeDataTheme({ root, theme });
  listeners.forEach((listener) => listener());
};

let releaseToken = 0;

const releaseTransitionsAfterPaint = (): void => {
  const root = document.documentElement;
  releaseToken += 1;
  const token = releaseToken;
  const release = () => {
    if (token !== releaseToken) {
      return;
    }
    releaseToken += 1;
    root.removeAttribute(SWITCHING_ATTRIBUTE);
  };
  window.setTimeout(release, RELEASE_GUARD_MS);
  if (typeof window.requestAnimationFrame !== 'function') {
    return;
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(release));
};

export const applyDocumentTheme = ({ theme }: { readonly theme: Theme }): void => {
  if (isApplied({ theme })) {
    return;
  }
  const root = document.documentElement;
  root.setAttribute(SWITCHING_ATTRIBUTE, '');
  swapDocumentTheme({ theme });
  void window.getComputedStyle(document.body).opacity;
  releaseTransitionsAfterPaint();
};

const resolvePreference = ({ preference }: { readonly preference: ThemePreference }): Theme =>
  resolveTheme({ preference, systemIsLight: lightQuery()?.matches === true });

const applyPreference = ({ preference }: { readonly preference: ThemePreference }): void => {
  applyDocumentTheme({ theme: resolvePreference({ preference }) });
};

type ThemeState = {
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
  readonly toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'dark',
  setPreference: (preference) => {
    themePref.write(preference);
    applyPreference({ preference });
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
  applyPreference({ preference });
  useThemeStore.setState({ preference });
  const query = lightQuery();
  const onSystemChange = () => {
    const current = useThemeStore.getState().preference;
    if (current !== 'system') {
      return;
    }
    applyPreference({ preference: current });
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !isThemePreference(event.newValue)) {
      return;
    }
    applyPreference({ preference: event.newValue });
    useThemeStore.setState({ preference: event.newValue });
  };
  window.addEventListener('storage', onStorage);
  query?.addEventListener('change', onSystemChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    query?.removeEventListener('change', onSystemChange);
  };
};
