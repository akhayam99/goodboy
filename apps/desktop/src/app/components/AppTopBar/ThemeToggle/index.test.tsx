// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { applyDocumentTheme, getAppliedTheme, useThemeStore } from '../../../../shared/lib/theme';
import { ThemeToggle } from '.';

const setTheme = ({
  preference,
  theme,
}: {
  readonly preference: 'dark' | 'light' | 'system';
  readonly theme: 'dark' | 'light';
}): void => {
  useThemeStore.setState({ preference });
  applyDocumentTheme({ theme });
};

afterEach(() => {
  cleanup();
  setTheme({ preference: 'dark', theme: 'dark' });
});

describe('ThemeToggle', () => {
  it('names the active theme and the switch it offers, for an explicit choice', () => {
    setTheme({ preference: 'dark', theme: 'dark' });
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Dark theme · Switch to light' })).toBeDefined();
  });

  it('names the system match separately from an explicit choice', () => {
    setTheme({ preference: 'system', theme: 'dark' });
    render(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: 'Matching system (dark) · Switch to light' }),
    ).toBeDefined();
  });

  it('shows the moon for dark and the sun for light', () => {
    setTheme({ preference: 'dark', theme: 'dark' });
    const { container, rerender } = render(<ThemeToggle />);
    expect(container.querySelector('.lucide-moon')).not.toBeNull();

    setTheme({ preference: 'light', theme: 'light' });
    rerender(<ThemeToggle />);
    expect(container.querySelector('.lucide-sun')).not.toBeNull();
  });

  it('turns Match system into an explicit choice on click', () => {
    setTheme({ preference: 'system', theme: 'dark' });
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button'));

    expect(useThemeStore.getState().preference).toBe('light');
    expect(getAppliedTheme()).toBe('light');
  });

  it('leaves the bar below the narrow threshold, in Settings and palette only', () => {
    render(<ThemeToggle />);

    const anchor = screen.getByRole('button').parentElement;
    expect(anchor?.className).toContain('hidden');
    expect(anchor?.className).toContain('@min-chrome-narrow/topbar:flex');
  });
});
