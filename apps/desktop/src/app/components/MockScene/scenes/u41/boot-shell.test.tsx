// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U41_BOOT_SHELL_SCENES } from './boot-shell';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
});

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U41_BOOT_SHELL_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(<Scene />);
};

const SCENE_WAIT = { timeout: 5000 };

describe('boot shell scenes', () => {
  it('registers every state', () => {
    Object.keys(U41_BOOT_SHELL_SCENES).forEach((id) => {
      expect(MOCK_SCENES[id]).toBeDefined();
    });
  });

  it('draws the shell with skeletons and no empty copy while the sessions load', async () => {
    mount({ id: 'boot-shell' });

    await screen.findByRole('status', { name: 'Loading board' });
    screen.getByRole('status', { name: 'Loading sessions' });
    screen.getByRole('navigation', { name: 'Sidebar' });
    expect(screen.queryByText('No sessions yet')).toBeNull();
    expect(screen.queryByText('Add a folder first')).toBeNull();
    expect(document.querySelector('[data-select-id]')).toBeNull();
  });

  it('swaps the skeletons for rows and cards once the sessions land', async () => {
    mount({ id: 'boot-shell-sessions' });

    await waitFor(
      () => expect(document.querySelector('[data-select-id]')).not.toBeNull(),
      SCENE_WAIT,
    );
    expect(screen.queryByRole('status', { name: 'Loading board' })).toBeNull();
    expect(screen.queryByRole('status', { name: 'Loading sessions' })).toBeNull();
  });

  it('opens the last session in place of the board', async () => {
    mount({ id: 'boot-shell-session' });

    await waitFor(
      () => expect(document.querySelector('[data-session-frame]')).not.toBeNull(),
      SCENE_WAIT,
    );
    expect(screen.queryByRole('status', { name: 'Loading board' })).toBeNull();
  });
});
