// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_SHELL_CLASSIC_BARS } from '../../settings';
import { ClassicBarsField } from './ClassicBarsField';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('ClassicBarsField', () => {
  it('starts off, so the column is the default frame', () => {
    useAppStore.setState({ settings: { [SETTING_SHELL_CLASSIC_BARS]: 'false' } });
    render(<ClassicBarsField />);

    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('saves the switch to the settings table when turned on', () => {
    const saveSetting = vi.fn(async () => undefined);
    useAppStore.setState({ settings: { [SETTING_SHELL_CLASSIC_BARS]: 'false' }, saveSetting });
    render(<ClassicBarsField />);

    fireEvent.click(screen.getByRole('switch'));

    expect(saveSetting).toHaveBeenCalledWith(SETTING_SHELL_CLASSIC_BARS, 'true');
  });

  it('loads the stored value once when the settings table has not been read yet', () => {
    const loadSetting = vi.fn(async (): Promise<string | null> => null);
    useAppStore.setState({ settings: {}, loadSetting });
    render(<ClassicBarsField />);

    expect(loadSetting).toHaveBeenCalledWith(SETTING_SHELL_CLASSIC_BARS);
  });
});
