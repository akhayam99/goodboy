// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { resolveTerminalTheme } from './terminal-theme';

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

    const theme = resolveTerminalTheme('dark');

    expect(theme.scrollbarSliderBackground).toBe('oklch(1 0 0 / 0.22)');
  });

  it('gives hover and active the same brighter tone, since xterm has no separate hover state', () => {
    setToken({ name: '--color-scrollbar-thumb-active', value: 'oklch(1 0 0 / 0.4)' });

    const theme = resolveTerminalTheme('dark');

    expect(theme.scrollbarSliderHoverBackground).toBe('oklch(1 0 0 / 0.4)');
    expect(theme.scrollbarSliderActiveBackground).toBe('oklch(1 0 0 / 0.4)');
  });

  it('falls back to the static palette when a token is missing', () => {
    const theme = resolveTerminalTheme('light');

    expect(theme.scrollbarSliderBackground).toBeUndefined();
  });
});
