// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U36_BOARD_RELOAD_SCENES } from './boardReload';

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
  const Scene = U36_BOARD_RELOAD_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u36 board and reload scenes', () => {
  it('registers a light and a dark scene per state', () => {
    for (const [name, Scene] of Object.entries(U36_BOARD_RELOAD_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
    expect(Object.keys(U36_BOARD_RELOAD_SCENES)).toHaveLength(4);
  });

  it.each(['light', 'dark'])(
    'u36-p3-board-facts-failed-%s draws the lanes with one line and Retry',
    async (theme) => {
      mount({ id: `u36-p3-board-facts-failed-${theme}` });

      await screen.findByText("Couldn't read what needs you");
      await screen.findByRole('button', { name: 'Retry' });
    },
  );

  it.each(['light', 'dark'])(
    'u36-p3-plans-tester-question-%s keeps the plans out of Needs you for a Tester question',
    async (theme) => {
      mount({ id: `u36-p3-plans-tester-question-${theme}` });

      await screen.findByRole('heading', { name: /^Ready/ });
      expect(screen.queryAllByText('2 questions')).toHaveLength(0);
      expect(screen.queryAllByText('1 question')).toHaveLength(0);
    },
  );
});
