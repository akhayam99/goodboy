// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26S_QUIET_ROWS_SCENES } from './QuietRowsScene';

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
  clearSceneInvoke();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_QUIET_ROWS_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U26S_QUIET_ROWS_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the quiet rows scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_QUIET_ROWS_SCENES).sort()).toEqual([
      'u26s-rows-branches',
      'u26s-rows-commits',
      'u26s-rows-menu',
      'u26s-rows-storage',
    ]);
    expect(MOCK_SCENES['u26s-rows-storage']).toBe(U26S_QUIET_ROWS_SCENES['u26s-rows-storage']);
  });

  it('u26s-rows-storage hovers the second worktree and keeps Remove in the header', async () => {
    mount({ id: 'u26s-rows-storage' });

    await waitFor(
      () => expect(document.querySelectorAll('[data-testid="storage-folder-row"]').length).toBe(3),
      WAIT,
    );
    await waitFor(
      () =>
        expect(
          document
            .querySelectorAll('[data-testid="storage-folder-row"]')[1]
            ?.hasAttribute('data-scene-hover'),
        ).toBe(true),
      WAIT,
    );

    expect(screen.getByRole('button', { name: /Remove 3 safe folders/ })).toBeDefined();
  });

  it('u26s-rows-branches lists four columns with Delete in a hover cell', async () => {
    mount({ id: 'u26s-rows-branches' });

    await waitFor(
      () => expect(document.querySelectorAll('[data-select-id]').length).toBeGreaterThan(1),
      WAIT,
    );

    expect(document.querySelector('[data-cell="action"].row-actions')).not.toBeNull();
    expect(screen.queryByRole('switch', { name: 'Show all branches' })).toBeNull();
  });

  it('u26s-rows-menu opens the registry menu of a commit', async () => {
    mount({ id: 'u26s-rows-menu' });

    const menu = await screen.findByRole('menu', undefined, WAIT);

    expect(menu.textContent).toContain('Copy SHA');
  });
});
