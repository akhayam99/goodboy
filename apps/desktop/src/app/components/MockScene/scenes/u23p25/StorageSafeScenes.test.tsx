// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { P25_STORAGE_SCENES } from './StorageSafeScenes';

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

type SceneId = keyof typeof P25_STORAGE_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = P25_STORAGE_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the safe to remove scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(P25_STORAGE_SCENES).sort()).toEqual([
      'p25-storage-terminal',
      'p25-storage-undo',
    ]);
    expect(MOCK_SCENES['p25-storage-undo']).toBe(P25_STORAGE_SCENES['p25-storage-undo']);
  });

  it('p25-storage-terminal names the shell that keeps a clean folder from the safe list', async () => {
    mount({ id: 'p25-storage-terminal' });

    await waitFor(
      () => expect(document.querySelectorAll('[data-testid="storage-folder-row"]').length).toBe(3),
      WAIT,
    );

    const row = document.querySelector<HTMLElement>('[data-status="terminal-open"]');
    if (row === null) {
      throw new Error('no row names the open terminal');
    }
    within(row).getByText('A terminal is open here');
    screen.getByRole('button', { name: /Remove 2 safe folders/ });
    within(row).getByRole('button', { name: 'Close 1 terminal' });
  });

  it('p25-storage-undo offers Undo after a removal and brings the folders back', async () => {
    mount({ id: 'p25-storage-undo' });

    const undo = await screen.findByRole('button', { name: 'Undo' }, WAIT);
    screen.getByText(/Removed 3 folders/);
    fireEvent.click(undo);

    await screen.findByText('Brought back 3 folders.', undefined, WAIT);
    expect(document.querySelectorAll('[data-testid="storage-folder-row"]').length).toBe(3);
  });
});
