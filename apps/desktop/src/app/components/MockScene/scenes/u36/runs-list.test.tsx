// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

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
import { U36_RUNS_LIST_SCENES } from './runs-list';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U36_RUNS_LIST_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U36_RUNS_LIST_SCENES[name];
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

describe('the u36 runs list scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U36_RUNS_LIST_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('u36-p14-runs-by-branch groups the runs under the three branches and No branch', async () => {
    await mount('u36-p14-runs-by-branch');

    const grid = screen.getByRole('list', { name: 'Runs' });
    within(grid).getByRole('list', { name: 'rec/2-backfill' });
    within(grid).getByRole('list', { name: 'fix/duplicate-credit' });
    within(grid).getByRole('list', { name: 'feat/retry-budget' });
    expect(screen.getByRole('tab', { name: 'By branch' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('u36-p14-runs-by-state files the runs by state with a real Continue and Start', async () => {
    await mount('u36-p14-runs-by-state');

    const grid = screen.getByRole('list', { name: 'Runs' });
    const headings = within(grid)
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Running', 'Idle', 'Finished', 'Archived']);
    screen.getByRole('button', { name: 'Continue' });
    screen.getByRole('button', { name: 'Start' });
    screen.getByRole('button', { name: 'Open Replay the failed webhooks, Agent, Stopped' });
  });

  it('u36-p14-runs-start-open opens the form in place under the Start a run row', async () => {
    await mount('u36-p14-runs-start-open');

    screen.getByRole('textbox', { name: 'Start a run' });
    screen.getByRole('list', { name: 'Runs' });
  });

  it('u36-p14-runs-empty is the form with no list and no row', async () => {
    await mount('u36-p14-runs-empty');

    screen.getByRole('textbox', { name: 'Start a run' });
    expect(screen.queryByRole('list', { name: 'Runs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start a run' })).toBeNull();
  });

  it('u36-p14-runs-drawer-open keeps the drawer beside the sheet and the list readable', async () => {
    await mount('u36-p14-runs-drawer-open');

    screen.getByRole('list', { name: 'Runs' });
    expect(document.querySelector('[aria-label="Side panel"]')).not.toBeNull();
  });
});
