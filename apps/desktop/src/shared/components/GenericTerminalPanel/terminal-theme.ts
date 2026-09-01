import type { ITheme } from '@xterm/xterm';

/**
 * xterm palettes. background / foreground / cursor are anchored to the app's
 * canvas tokens at runtime (see {@link resolveTerminalTheme}); the ANSI ramp
 * stays fixed so program output keeps stable, recognizable colors across themes.
 */
const LIGHT_THEME: ITheme = {
  background: '#f8f8f8',
  foreground: '#1a1a2e',
  cursor: '#4078f2',
  selectionBackground: '#4078f230',
  black: '#383a42',
  red: '#e45649',
  green: '#50a14f',
  yellow: '#c18401',
  blue: '#4078f2',
  magenta: '#a626a4',
  cyan: '#0184bc',
  white: '#fafafa',
  brightBlack: '#696c77',
  brightRed: '#e45649',
  brightGreen: '#50a14f',
  brightYellow: '#986801',
  brightBlue: '#4078f2',
  brightMagenta: '#a626a4',
  brightCyan: '#0184bc',
  brightWhite: '#ffffff',
};

const DARK_THEME: ITheme = {
  background: '#1a1a1f',
  foreground: '#e6e6e6',
  cursor: '#8ab4f8',
  selectionBackground: '#8ab4f840',
  black: '#3c3c3c',
  red: '#ff7b72',
  green: '#7ee787',
  yellow: '#f0c674',
  blue: '#8ab4f8',
  magenta: '#d2a8ff',
  cyan: '#79c0ff',
  white: '#d0d0d0',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#7ee787',
  brightYellow: '#ffd66e',
  brightBlue: '#8ab4f8',
  brightMagenta: '#d2a8ff',
  brightCyan: '#79c0ff',
  brightWhite: '#ffffff',
};

const readToken = (styles: CSSStyleDeclaration, token: string): string | null => {
  const value = styles.getPropertyValue(token).trim();
  return value.length > 0 ? value : null;
};

/**
 * Returns the palette for the active theme with its surface colors
 * (background / foreground / cursor) anchored to the live canvas tokens, so the
 * terminal sits flush with the surrounding app surface. The fixed ANSI ramp is
 * preserved. Falls back to the static palette when tokens can't be resolved
 * (e.g. SSR or a detached node).
 */
export const resolveTerminalTheme = (theme: 'dark' | 'light'): ITheme => {
  const base = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return base;
  }
  const styles = window.getComputedStyle(document.documentElement);
  const background = readToken(styles, '--color-background');
  const foreground = readToken(styles, '--color-foreground');
  const cursor = readToken(styles, '--color-primary');
  return {
    ...base,
    ...(background ? { background } : {}),
    ...(foreground ? { foreground } : {}),
    ...(cursor ? { cursor } : {}),
  };
};
