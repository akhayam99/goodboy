// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getSetting, setSetting } from '@goodboy/db';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SETTING_LINKS_OPEN } from '../../../../../shared/lib/linksOpenSetting';
import { LinksOpenField } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
});

afterEach(cleanup);

const tabNamed = ({ name }: { readonly name: string }) => screen.getByRole('tab', { name });

describe('the Links row in Open with', () => {
  it('starts on In Goodboy when nothing was saved', async () => {
    render(<LinksOpenField />);

    await waitFor(() =>
      expect(tabNamed({ name: 'In Goodboy' }).getAttribute('aria-selected')).toBe('true'),
    );
    expect(tabNamed({ name: 'In your browser' }).getAttribute('aria-selected')).toBe('false');
  });

  it('reads the saved value', async () => {
    await setSetting(storySqlite(), SETTING_LINKS_OPEN, 'browser');

    render(<LinksOpenField />);

    await waitFor(() =>
      expect(tabNamed({ name: 'In your browser' }).getAttribute('aria-selected')).toBe('true'),
    );
  });

  it('saves the value it was flipped to', async () => {
    render(<LinksOpenField />);

    fireEvent.click(tabNamed({ name: 'In your browser' }));

    await waitFor(async () =>
      expect(await getSetting(storySqlite(), SETTING_LINKS_OPEN)).toBe('browser'),
    );
    expect(tabNamed({ name: 'In your browser' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the old value and says so when the save fails', async () => {
    await setSetting(storySqlite(), SETTING_LINKS_OPEN, 'goodboy');
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      reportError,
      saveSetting: async () => {
        throw new Error('disk full');
      },
    });
    render(<LinksOpenField />);
    await waitFor(() =>
      expect(tabNamed({ name: 'In Goodboy' }).getAttribute('aria-selected')).toBe('true'),
    );

    fireEvent.click(tabNamed({ name: 'In your browser' }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't save where links open" }),
      ),
    );
    expect(tabNamed({ name: 'In Goodboy' }).getAttribute('aria-selected')).toBe('true');
  });
});
