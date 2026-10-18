// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { FoldersScene } from './FoldersScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the folder face scenes', () => {
  it('home names each one folder workspace by its face', async () => {
    render(<FoldersScene state="home" theme="light" />);

    expect(
      await screen.findByText('Code, no git yet · ~/Code/acme-web', undefined, WAIT),
    ).toBeDefined();
    expect(screen.getByText('Documents · ~/Documents/acme-notes')).toBeDefined();
    expect(screen.getByText('3 folders · ~/Code/harborline')).toBeDefined();
  });

  it('settings shows the switch and the saved versions of acme-notes', async () => {
    render(<FoldersScene state="settings" theme="light" />);

    const band = await screen.findByRole('region', { name: 'Plain folders' }, WAIT);
    const faces = within(band).getByRole('tablist', { name: 'What acme-notes is for' });
    expect(
      within(faces).getByRole('tab', { name: 'Documents' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(within(band).getByText(/Saved versions for acme-notes: 18 MB of 1.0 GB/)).toBeDefined();
  });
});
