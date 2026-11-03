// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { DemoStorageScene } from './DemoStorageScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('demo-storage', () => {
  it('renders the Storage page with the seeded folders', async () => {
    render(<DemoStorageScene />);

    await screen.findByRole('region', { name: 'Worktrees' }, WAIT);
    await screen.findByText(/Retry credit notes after a provider timeout/, undefined, WAIT);
    expect(document.querySelectorAll('[data-testid="storage-folder-row"]').length).toBe(3);
    screen.getByRole('button', { name: /Remove 3 safe folders/ });
  });
});
