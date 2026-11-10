// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U39_P9_SCENES } from './p9-one-slot';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U39_P9_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U39_P9_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const sidePanelMode = (): string | null =>
  document.querySelector('aside[aria-label="Side panel"]')?.getAttribute('data-drawer-mode') ??
  null;

const slot = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-drawer-main] [data-studio-slot="content"]');

describe('the ux39 P9 one slot scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U39_P9_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('ux39-p9-session-drawer shows the session with its drawer beside it', async () => {
    await mount('ux39-p9-session-drawer');

    expect(slot()).toBeNull();
    expect(sidePanelMode()).not.toBe('closed');
  });

  it.each(['ux39-p9-tasks-parked', 'ux39-p9-impact-parked', 'ux39-p9-workflows-parked'] as const)(
    '%s draws the page inside the sheet and parks the drawer',
    async (name) => {
      await mount(name);

      expect(slot()).not.toBeNull();
      expect(sidePanelMode()).toBe('closed');
      expect(useAppStore.getState().drawer?.kind).toBe('context');
    },
  );
});
