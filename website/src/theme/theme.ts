import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'goodboy-site:theme';

const SYSTEM_DARK = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SWITCHING_ATTRIBUTE = 'data-theme-switching';

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

const applyThemeInstant = ({ theme }: ApplyParams): void => {
  const root = document.documentElement;
  root.setAttribute(SWITCHING_ATTRIBUTE, '');
  applyTheme({ theme });
  void window.getComputedStyle(document.body).opacity;
  window.setTimeout(() => root.removeAttribute(SWITCHING_ATTRIBUTE), 1);
};

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

const canTransition = (): boolean =>
  typeof document.startViewTransition === 'function' && !prefersReducedMotion();

let isTransitioning = false;
let queuedTheme: Theme | null = null;

const transitionTheme = ({ theme }: ApplyParams): void => {
  if (isTransitioning) {
    queuedTheme = theme;
    return;
  }
  if (currentTheme() === theme) {
    return;
  }
  if (!canTransition()) {
    applyThemeInstant({ theme });
    return;
  }
  const root = document.documentElement;
  isTransitioning = true;
  root.setAttribute(SWITCHING_ATTRIBUTE, '');
  const transition = document.startViewTransition(() => applyTheme({ theme }));
  transition.ready.catch(() => undefined);
  void transition.finished
    .catch(() => undefined)
    .then(() => {
      isTransitioning = false;
      root.removeAttribute(SWITCHING_ATTRIBUTE);
      const next = queuedTheme;
      queuedTheme = null;
      if (next !== null) {
        transitionTheme({ theme: next });
      }
    });
};

const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const media = window.matchMedia(SYSTEM_DARK);
  const onSystem = () => {
    if (readStored() !== null) {
      return;
    }
    transitionTheme({ theme: systemTheme() });
  };
  media.addEventListener('change', onSystem);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', onSystem);
  };
};

export const useTheme = (): Theme => useSyncExternalStore(subscribe, currentTheme, () => 'light');

export const setTheme = ({ theme }: ApplyParams) => {
  transitionTheme({ theme });
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    return;
  }
};
