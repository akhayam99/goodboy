// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U36_P1_RUNSTOP_SCENES } from './p1-runstop';

const SETTLE_MS = 2_000;

const NAMES = ['u36-p1-run-stopping', 'u36-p1-run-stopped'] as const;

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
  const Scene = U36_P1_RUNSTOP_SCENES[name];
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

describe('the run stop scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U36_P1_RUNSTOP_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U36_P1_RUNSTOP_SCENES[name]);
    }
  });

  it('u36-p1-run-stopping reads Stopping while the step ends its work, never Stopped', async () => {
    await mount({ name: 'u36-p1-run-stopping' });

    expect(screen.getAllByText(/Stopping/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Stopped by you/)).toBeNull();
  });

  it('u36-p1-run-stopped reads Not finished on the cut step and offers Continue', async () => {
    await mount({ name: 'u36-p1-run-stopped' });

    expect(screen.queryByText('Ready for the next step')).toBeNull();
    expect(screen.getAllByText(/^Stopped by you/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Continue/ }).length).toBeGreaterThan(0);
  });
});
