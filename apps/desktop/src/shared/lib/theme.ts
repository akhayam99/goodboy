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

export const bootstrapTheme = (): (() => void) => {
  const preference = readStoredPreference();
  useThemeStore.setState({ preference, theme: resolveAndApply({ preference }) });
  const query = lightQuery();
  if (query === null) {
    return () => undefined;
  }
  const onChange = () => {
    const current = useThemeStore.getState().preference;
    if (current !== 'system') {
      return;
    }
    useThemeStore.setState({ theme: resolveAndApply({ preference: current }) });
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
