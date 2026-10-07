// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_SHELL_CLASSIC_BARS } from '../../settings';
import { LegacyLayoutField } from './LegacyLayoutField';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('LegacyLayoutField', () => {
  it('names the setting Legacy layout and says it may be removed', () => {
    useAppStore.setState({ settings: { [SETTING_SHELL_CLASSIC_BARS]: 'false' } });
    render(<LegacyLayoutField />);

    expect(screen.getAllByText('Legacy layout')).toHaveLength(2);
    expect(
      screen.getByText(
        'Board and Chat in the top bar and the other doors in a footer, as in 0.20. It may be removed in a future version.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('Classic bars')).toBeNull();
  });

  it('says On or Off beside the switch and keeps the setting as its name', () => {
    useAppStore.setState({ settings: { [SETTING_SHELL_CLASSIC_BARS]: 'false' } });
    render(<LegacyLayoutField />);

    const toggle = screen.getByRole('switch', { name: 'Legacy layout' });

    expect(within(toggle).getByText('Off').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByText('On')).toBeNull();

    cleanup();
    useAppStore.setState({ settings: { [SETTING_SHELL_CLASSIC_BARS]: 'true' } });
    render(<LegacyLayoutField />);

    expect(
      within(screen.getByRole('switch', { name: 'Legacy layout' })).getByText('On'),
    ).toBeDefined();
    expect(screen.queryByText('Off')).toBeNull();
  });

  it('starts off, so the column is the default frame', () => {
    useAppStore.setState({ settings: { [SETTING_SHELL_CLASSIC_BARS]: 'false' } });
    render(<LegacyLayoutField />);

    expect(screen.getByRole('switch', { name: 'Legacy layout' }).getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('reads a value stored before the rename, under the same key', () => {
    useAppStore.setState({ settings: { 'shell.classicBars': 'true' } });
    render(<LegacyLayoutField />);

    expect(SETTING_SHELL_CLASSIC_BARS).toBe('shell.classicBars');
    expect(screen.getByRole('switch', { name: 'Legacy layout' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('saves the switch to the settings table when turned on', () => {
    const saveSetting = vi.fn(async () => undefined);
    useAppStore.setState({ settings: { [SETTING_SHELL_CLASSIC_BARS]: 'false' }, saveSetting });
    render(<LegacyLayoutField />);

    fireEvent.click(screen.getByRole('switch', { name: 'Legacy layout' }));

    expect(saveSetting).toHaveBeenCalledWith(SETTING_SHELL_CLASSIC_BARS, 'true');
  });

  it('reports a failed save as a layout switch that did not happen', async () => {
    const saveSetting = vi.fn(async () => {
      throw new Error('disk full');
    });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      settings: { [SETTING_SHELL_CLASSIC_BARS]: 'false' },
      saveSetting,
      reportError,
    });
    render(<LegacyLayoutField />);

    fireEvent.click(screen.getByRole('switch', { name: 'Legacy layout' }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't switch the layout" }),
      ),
    );
  });

  it('loads the stored value once when the settings table has not been read yet', () => {
    const loadSetting = vi.fn(async (): Promise<string | null> => null);
    useAppStore.setState({ settings: {}, loadSetting });
    render(<LegacyLayoutField />);

    expect(loadSetting).toHaveBeenCalledWith(SETTING_SHELL_CLASSIC_BARS);
  });
});
