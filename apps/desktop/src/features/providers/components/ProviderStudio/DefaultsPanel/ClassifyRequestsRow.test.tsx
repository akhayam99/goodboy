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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SETTING_CLASSIFY_REQUESTS } from '../../../../settings/settings';
import { ClassifyRequestsRow } from './ClassifyRequestsRow';

let useAppStore: StoryStore;

const toggle = () => screen.getByRole('switch', { name: 'Let a small model read typed requests' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
});

afterEach(cleanup);

describe('ClassifyRequestsRow', () => {
  it('ships off and says Auto starts on the request as typed', () => {
    render(<ClassifyRequestsRow />);

    expect(toggle().getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/Auto starts on the request exactly as you typed it/)).not.toBeNull();
  });

  it('saves the choice and says which model reads the request once it is on', async () => {
    render(<ClassifyRequestsRow />);

    fireEvent.click(toggle());

    await waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_CLASSIFY_REQUESTS]).toBe('true'),
    );
    await waitFor(() => expect(toggle().getAttribute('aria-checked')).toBe('true'));
    expect(screen.queryByText(/the Agent naming model/)).not.toBeNull();
  });

  it('turns it off again and writes false', async () => {
    useAppStore.setState({ settings: { [SETTING_CLASSIFY_REQUESTS]: 'true' } });
    render(<ClassifyRequestsRow />);

    fireEvent.click(toggle());

    await waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_CLASSIFY_REQUESTS]).toBe('false'),
    );
  });
});
