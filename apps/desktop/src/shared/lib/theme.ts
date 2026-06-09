import { create } from 'zustand';
import { STORAGE_KEYS } from './storage-keys';

type Theme = 'dark' | 'light';

const STORAGE_KEY = STORAGE_KEYS.theme;

function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light') return 'light';
  } catch {}
  return 'dark';
}

function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

export const bootstrapTheme = (): void => {
  const stored = readStoredTheme();
  applyTheme(stored);
  useThemeStore.setState({ theme: stored });
};
