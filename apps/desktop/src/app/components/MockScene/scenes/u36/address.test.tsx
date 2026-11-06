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
import { U36_ADDRESS_SCENES } from './address';

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
  const Scene = U36_ADDRESS_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u36 address scenes', () => {
  it('registers a light and a dark scene per state', () => {
    for (const [name, Scene] of Object.entries(U36_ADDRESS_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(Scene);
    }
    expect(Object.keys(U36_ADDRESS_SCENES)).toHaveLength(4);
  });

  it.each(['light', 'dark'])(
    'u36-p6-gone-run-%s says the run is gone under its back row',
    async (theme) => {
      mount({ id: `u36-p6-gone-run-${theme}` });

      await screen.findByText('This run is no longer in this session');
      await screen.findByRole('button', { name: 'Back to runs' });
    },
  );

  it.each(['light', 'dark'])(
    'u36-p6-step-back-%s names the run of the step in its back row',
    async (theme) => {
      mount({ id: `u36-p6-step-back-${theme}` });

      await screen.findByRole('button', { name: 'Back to Duplicate credit fix' });
    },
  );
});
