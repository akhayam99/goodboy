// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
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

    expect(screen.getAllByText('Not finished').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Continue/ }).length).toBeGreaterThan(0);
  });
});
