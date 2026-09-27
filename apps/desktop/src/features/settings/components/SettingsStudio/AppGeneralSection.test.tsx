// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../../../store';
import { useThemeStore } from '../../../../shared/lib/theme';
import { AppGeneralSection } from './AppGeneralSection';

const loadDetectedEditors = vi.fn(async () => undefined);
const loadSetting = vi.fn(async () => null as string | null);
const saveSetting = vi.fn(async () => undefined);
const reportError = vi.fn(async () => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    detectedEditors: [],
    loadDetectedEditors,
    loadSetting,
    saveSetting,
    reportError,
  } as never);
  useThemeStore.setState({ preference: 'dark' });
});

afterEach(cleanup);

describe('AppGeneralSection theme control', () => {
  it('shows light, dark and system as a segmented control', () => {
    render(<AppGeneralSection />);

    expect(screen.getByRole('tablist', { name: 'Theme' })).toBeTruthy();
    ['Light', 'Dark', 'System'].forEach((label) => {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    });
    expect(screen.getByRole('tab', { name: 'Dark' }).getAttribute('aria-selected')).toBe('true');
  });

  it('switches the real theme store when a segment is picked', async () => {
    render(<AppGeneralSection />);

    await userEvent.click(screen.getByRole('tab', { name: 'Light' }));

    expect(useThemeStore.getState().preference).toBe('light');
    expect(screen.getByRole('tab', { name: 'Light' }).getAttribute('aria-selected')).toBe('true');
  });
});
