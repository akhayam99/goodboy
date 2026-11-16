// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { resolveTerminalFindColors, resolveTerminalTheme } from './terminal-theme';

const setToken = ({ name, value }: { readonly name: string; readonly value: string }): void => {
  document.documentElement.style.setProperty(name, value);
};

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('resolveTerminalTheme', () => {
  it('reads the scrollbar thumb tokens for the resting slider color', () => {
    setToken({ name: '--color-scrollbar-thumb', value: 'oklch(1 0 0 / 0.22)' });
    setToken({ name: '--color-scrollbar-thumb-active', value: 'oklch(1 0 0 / 0.4)' });

    const theme = resolveTerminalTheme({ theme: 'dark' });

    expect(theme.scrollbarSliderBackground).toBe('oklch(1 0 0 / 0.22)');
  });

  it('gives hover and active the same brighter tone, since xterm has no separate hover state', () => {
    setToken({ name: '--color-scrollbar-thumb-active', value: 'oklch(1 0 0 / 0.4)' });

    const theme = resolveTerminalTheme({ theme: 'dark' });

    expect(theme.scrollbarSliderHoverBackground).toBe('oklch(1 0 0 / 0.4)');
    expect(theme.scrollbarSliderActiveBackground).toBe('oklch(1 0 0 / 0.4)');
  });

  it('reads the ANSI colors from the scale steps of the applied theme', () => {
    setToken({ name: '--red-11', value: 'oklch(0.51 0.195 25)' });
    setToken({ name: '--gray-10', value: 'oklch(0.495 0.013 264)' });
    setToken({ name: '--gray-12', value: 'oklch(0.215 0.012 264)' });

    const theme = resolveTerminalTheme({ theme: 'light' });

    expect(theme.red).toBe('oklch(0.51 0.195 25)');
    expect(theme.brightRed).toBe('oklch(0.51 0.195 25)');
    expect(theme.white).toBe('oklch(0.495 0.013 264)');
    expect(theme.black).toBe('oklch(0.215 0.012 264)');
  });

  it('paints the selection with the app selection token', () => {
    setToken({ name: '--color-selection', value: 'oklch(0.39 0.116 259)' });

    expect(resolveTerminalTheme({ theme: 'dark' }).selectionBackground).toBe(
      'oklch(0.39 0.116 259)',
    );
  });

  it('leaves a color to xterm when its token is missing', () => {
    const theme = resolveTerminalTheme({ theme: 'light' });

    expect(theme.scrollbarSliderBackground).toBeUndefined();
    expect(theme.red).toBeUndefined();
  });
});

describe('resolveTerminalFindColors', () => {
  it('highlights matches with the amber steps', () => {
    setToken({ name: '--amber-6', value: 'oklch(0.39 0.093 58)' });
    setToken({ name: '--amber-8', value: 'oklch(0.53 0.12 63)' });
    setToken({ name: '--amber-9', value: 'oklch(0.8 0.16 78)' });
    setToken({ name: '--amber-11', value: 'oklch(0.82 0.14 80)' });

    expect(resolveTerminalFindColors({ theme: 'dark' })).toEqual({
      matchBackground: 'oklch(0.39 0.093 58)',
      matchOverviewRuler: 'oklch(0.8 0.16 78)',
      activeMatchBackground: 'oklch(0.53 0.12 63)',
      activeMatchColorOverviewRuler: 'oklch(0.82 0.14 80)',
    });
  });

  it('drops the highlight instead of passing xterm an empty color', () => {
    setToken({ name: '--amber-6', value: 'oklch(0.39 0.093 58)' });

    expect(resolveTerminalFindColors({ theme: 'dark' })).toBeUndefined();
  });
});
