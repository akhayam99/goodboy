// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { STORAGE_SUGGEST_AFTER_KEY } from '../../../../../store/slices/storage/storageSettings';
import { StorageSuggestAfterRow } from '.';

let useAppStore: StoryStore;

const trigger = () => screen.getByRole('combobox', { name: 'Suggest cleanup after' });

const pick = ({ label }: { readonly label: string }) => {
  fireEvent.click(trigger());
  fireEvent.click(screen.getByRole('option', { name: label }));
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('StorageSuggestAfterRow', () => {
  it('is a row with its help line, on 30 days by default', () => {
    render(<StorageSuggestAfterRow />);

    screen.getByText('Folders idle this long show up as safe to remove.');
    expect(trigger().textContent).toContain('30 days');
  });

  it('saves the new number of days', async () => {
    render(<StorageSuggestAfterRow />);

    pick({ label: '14 days' });

    await waitFor(() =>
      expect(useAppStore.getState().settings[STORAGE_SUGGEST_AFTER_KEY]).toBe('14'),
    );
    expect(storySpies.setSetting).toHaveBeenCalledWith(
      expect.anything(),
      STORAGE_SUGGEST_AFTER_KEY,
      '14',
    );
    expect(trigger().textContent).toContain('14 days');
  });

  it('keeps the old value when the save fails', async () => {
    useAppStore.setState({ settings: { [STORAGE_SUGGEST_AFTER_KEY]: '60' } });
    storySpies.setSetting.mockRejectedValueOnce(new Error('disk is full'));
    render(<StorageSuggestAfterRow />);

    pick({ label: '7 days' });

    await waitFor(() =>
      expect(useAppStore.getState().notifications.some((n) => n.title.includes('cleanup'))).toBe(
        true,
      ),
    );
    expect(useAppStore.getState().settings[STORAGE_SUGGEST_AFTER_KEY]).toBe('60');
    expect(trigger().textContent).toContain('60 days');
  });
});
