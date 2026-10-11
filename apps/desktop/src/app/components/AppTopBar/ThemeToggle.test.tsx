// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { applyDocumentTheme, switchTheme, useThemeStore } from '../../../shared/lib/theme';
import { ThemeToggle } from './ThemeToggle';

const reset = (): void => {
  localStorage.clear();
  applyDocumentTheme({ theme: 'dark' });
  useThemeStore.setState({ preference: 'dark' });
};

beforeEach(reset);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  reset();
});

describe('the top bar theme toggle', () => {
  it('shows the dark theme and writes light on click', () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Dark theme. Switch to light' });
    fireEvent.click(toggle);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light');
    expect(toggle.getAttribute('aria-label')).toBe('Light theme. Switch to dark');
  });

  it('writes the explicit opposite of what shows while matching the system', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    switchTheme({ to: 'system' });
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Matching system (dark). Switch to light' });
    fireEvent.click(toggle);

    expect(useThemeStore.getState().preference).toBe('light');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light');
  });
});
