// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useThemeStore } from '../../../../shared/lib/theme';
import { ThemeToggle } from '.';

afterEach(() => {
  cleanup();
  useThemeStore.setState({ preference: 'dark', theme: 'dark' });
});

describe('ThemeToggle', () => {
  it('names the active theme and the switch it offers, for an explicit choice', () => {
    useThemeStore.setState({ preference: 'dark', theme: 'dark' });
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Dark theme · Switch to light' })).toBeDefined();
  });

  it('names the system match separately from an explicit choice', () => {
    useThemeStore.setState({ preference: 'system', theme: 'dark' });
    render(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: 'Matching system (dark) · Switch to light' }),
    ).toBeDefined();
  });

  it('shows the moon for dark and the sun for light', () => {
    useThemeStore.setState({ preference: 'dark', theme: 'dark' });
    const { container, rerender } = render(<ThemeToggle />);
    expect(container.querySelector('.lucide-moon')).not.toBeNull();

    useThemeStore.setState({ preference: 'light', theme: 'light' });
    rerender(<ThemeToggle />);
    expect(container.querySelector('.lucide-sun')).not.toBeNull();
  });

  it('turns Match system into an explicit choice on click', () => {
    useThemeStore.setState({ preference: 'system', theme: 'dark' });
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button'));

    expect(useThemeStore.getState()).toMatchObject({ preference: 'light', theme: 'light' });
  });

  it('leaves the bar below the narrow threshold, in Settings and palette only', () => {
    render(<ThemeToggle />);

    const anchor = screen.getByRole('button').parentElement;
    expect(anchor?.className).toContain('hidden');
    expect(anchor?.className).toContain('@min-chrome-narrow/topbar:flex');
  });
});
