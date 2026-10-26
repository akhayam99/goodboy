// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SETTING_REPO_CHECK_MINUTES } from '../../settings';
import { RepoCheckBand } from './RepoCheckBand';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('how often the repositories are checked', () => {
  it('reads five minutes by default and saves the chosen interval', async () => {
    render(<RepoCheckBand />);
    expect(screen.getByRole('tab', { name: '5 min' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: '15 min' }));

    await waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_REPO_CHECK_MINUTES]).toBe('15'),
    );
    expect(screen.getByRole('tab', { name: '15 min' }).getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the old interval when the save fails and says nothing was changed', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      settings: { [SETTING_REPO_CHECK_MINUTES]: '30' },
      saveSetting: async () => {
        throw new Error('database is locked');
      },
      reportError,
    });
    render(<RepoCheckBand />);

    fireEvent.click(screen.getByRole('tab', { name: 'Off' }));

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Off' }).hasAttribute('disabled')).toBe(false),
    );
    expect(useAppStore.getState().settings[SETTING_REPO_CHECK_MINUTES]).toBe('30');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't save how often to check the repositories",
        recovery: { clause: 'nothing-changed' },
      }),
    );
  });
});
