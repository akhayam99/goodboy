// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U36_P1_WINDOW_CLOSE_SCENES } from './p1-window-close';

const SETTLE_MS = 2_000;

const NAMES = [
  'u36-p1-window-close',
  'u36-p1-window-close-run',
  'u36-p1-window-close-stuck',
] as const;

type SceneName = (typeof NAMES)[number];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U36_P1_WINDOW_CLOSE_SCENES[name];
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

describe('the window close scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U36_P1_WINDOW_CLOSE_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U36_P1_WINDOW_CLOSE_SCENES[name]);
    }
  });

  it('u36-p1-window-close asks once: Stop 2 agents, or Cancel', async () => {
    await mount({ name: 'u36-p1-window-close' });

    const sheet = within(
      screen.getByRole('dialog', { name: '2 agents still working in this window' }),
    );
    sheet.getByRole('button', { name: 'Stop 2 agents' });

    await act(async () => {
      fireEvent.click(sheet.getByRole('button', { name: 'Cancel' }));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('u36-p1-window-close-run counts a deciding run next to the agent', async () => {
    await mount({ name: 'u36-p1-window-close-run' });

    const sheet = within(
      screen.getByRole('dialog', { name: '1 agent and 1 run still working in this window' }),
    );
    sheet.getByRole('button', { name: 'Stop 1 agent and 1 run' });
  });

  it("u36-p1-window-close-stuck says the agent didn't stop and offers Close anyway", async () => {
    await mount({ name: 'u36-p1-window-close-stuck' });

    const sheet = within(screen.getByRole('dialog', { name: "1 agent didn't stop" }));
    sheet.getByRole('button', { name: 'Close anyway' });
  });
});
