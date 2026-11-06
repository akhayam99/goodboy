// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U36_P2_SEND_SCENES } from './p2-send';

const SETTLE_MS = 2_000;

const NAMES = ['u36-p2-send-held', 'u36-p2-send-stopped'] as const;

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
  localStorage.clear();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams) => {
  const Scene = U36_P2_SEND_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  const row = screen.getByTestId('queued-message-row');
  return {
    row,
    status: within(row).getByTestId('queued-message-status').textContent,
  };
};

describe('the durable send scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U36_P2_SEND_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U36_P2_SEND_SCENES[name]);
    }
  });

  it('shows a refused message as Not delivered with Retry', async () => {
    const { row, status } = await mount({ name: 'u36-p2-send-held' });

    expect(status).toBe('Not delivered');
    expect(row.getAttribute('data-status')).toBe('notDelivered');
    expect(within(row).getByRole('button', { name: 'Retry' }).hasAttribute('disabled')).toBe(false);
  });

  it('says a message for a stopped agent sends when you Continue', async () => {
    const { status } = await mount({ name: 'u36-p2-send-stopped' });

    expect(status).toBe('Sends when you Continue');
  });
});
