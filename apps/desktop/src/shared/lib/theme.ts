import { create } from 'zustand';
import { STORAGE_KEYS } from './storage-keys';

export type Theme = 'dark' | 'light';

export type ThemePreference = Theme | 'system';

const STORAGE_KEY = STORAGE_KEYS.theme;
const LIGHT_QUERY = '(prefers-color-scheme: light)';

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

const applyTheme = ({ theme }: { readonly theme: Theme }): void => {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    return;
  }
  document.documentElement.removeAttribute('data-theme');
};

const resolveAndApply = ({ preference }: { readonly preference: ThemePreference }): Theme => {
  const theme = resolveTheme({ preference, systemIsLight: lightQuery()?.matches === true });
  applyTheme({ theme });
  return theme;
};

type ThemeState = {
  readonly preference: ThemePreference;
  readonly theme: Theme;
  readonly setPreference: (preference: ThemePreference) => void;
  readonly toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'dark',
  theme: 'dark',
  setPreference: (preference) => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {}
    set({ preference, theme: resolveAndApply({ preference }) });
  },
  toggleTheme: () => {
    get().setPreference(get().theme === 'dark' ? 'light' : 'dark');
  },
}));

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

export const bootstrapTheme = (): (() => void) => {
  const preference = readStoredPreference();
  useThemeStore.setState({ preference, theme: resolveAndApply({ preference }) });
  const query = lightQuery();
  const onSystemChange = () => {
    const current = useThemeStore.getState().preference;
    if (current !== 'system') {
      return;
    }
    useThemeStore.setState({ theme: resolveAndApply({ preference: current }) });
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !isThemePreference(event.newValue)) {
      return;
    }
    useThemeStore.setState({
      preference: event.newValue,
      theme: resolveAndApply({ preference: event.newValue }),
    });
  };
  window.addEventListener('storage', onStorage);
  query?.addEventListener('change', onSystemChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    query?.removeEventListener('change', onSystemChange);
  };
};

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const withViewTransition = (update: () => void): void => {
  if (reducedMotion() || typeof document.startViewTransition !== 'function') {
    update();
    return;
  }
  document.startViewTransition(update);
};
