// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../test/sceneInvoke';

const NARROW_PAGE_PX = 800;
const FIND_TIMEOUT_MS = 5000;

type ObserverCallback = (
  entries: ReadonlyArray<{ contentRect: { width: number }; target: Element }>,
) => void;

const stubNarrowPage = () => {
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback([{ contentRect: { width: NARROW_PAGE_PX }, target }]);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

const CALLERS = [
  { scene: 'terminal-studio', rail: 'terminals' },
  { scene: 'notifications', rail: 'notification filters' },
  { scene: 'settings-general-pinned', rail: 'settings scopes' },
  { scene: 'chat-room', rail: 'chat list' },
  { scene: 'changelog', rail: 'releases' },
  { scene: 'guide', rail: 'guide chapters' },
  { scene: 'changes-files-all', rail: 'files' },
] as const;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.unstubAllGlobals();
});

describe('every page with an inner list folds it under 880px of page', () => {
  it.each(CALLERS)(
    '$scene at 800px folds its $rail and keeps the button that opens it',
    async ({ scene, rail }) => {
      stubNarrowPage();
      const Scene = MOCK_SCENES[scene];
      if (Scene === undefined) {
        throw new Error(`${scene} is not a registered scene`);
      }
      render(
        <ToastProvider>
          <Scene />
        </ToastProvider>,
      );

      const show = await screen.findByRole(
        'button',
        { name: `Show ${rail}` },
        { timeout: FIND_TIMEOUT_MS },
      );

      expect(show.closest('[inert]')).toBeNull();
    },
  );
});
